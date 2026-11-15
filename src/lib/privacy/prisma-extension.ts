import { Prisma, type PrismaClient } from "@prisma/client";
import type { PrivateCrypto } from "./crypto";
import { PRIVATE_FILE_MAGIC } from "./crypto";
import { identityLookupFields, lookupContext, normalizeLookup, privateBytesFields, privateJsonFields, privateTextFields } from "./fields";

type Row = Record<string, unknown>;
const object = (value: unknown): value is Row => !!value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;
const relations = Object.fromEntries(Prisma.dmmf.datamodel.models.map((model) => [model.name,
  Object.fromEntries(model.fields.filter((field) => field.kind === "object").map((field) => [field.name, field.type])),
])) as Record<string, Record<string, string>>;
const mapOneOrMany = (value: unknown, fn: (value: Row) => Row): unknown => Array.isArray(value)
  ? value.map((entry) => object(entry) ? fn(entry) : entry) : object(value) ? fn(value) : value;

/** Model-aware traversal is required: Prisma query extensions do not invoke nested hooks. */
export function privateDataCodec(getCrypto: () => PrivateCrypto) {
  const lookup = (model: string, field: string, value: string) => getCrypto().lookup(normalizeLookup(field, value), lookupContext(model, field));

  function identityCondition(model: string, field: string, condition: unknown): Row {
    if (condition === null) return { [field]: null };
    const index = identityLookupFields[model][field];
    const positive = (value: string | string[]) => ({ OR: [
      { AND: [{ [index]: { not: null } }, { [index]: Array.isArray(value) ? { in: value.map((part) => lookup(model, field, part)) } : lookup(model, field, value) }] },
      // Mixed reads support the resumable migration; newly written values are always encrypted.
      { [field]: Array.isArray(value) ? { in: value } : value },
    ] });
    if (typeof condition === "string") return positive(condition);
    if (!object(condition)) throw new Error("Unsupported private identity filter.");
    const clauses: Row[] = [];
    for (const [operator, value] of Object.entries(condition)) {
      if (operator === "mode" && (value === "default" || field !== "name")) continue;
      if (operator === "equals" && (typeof value === "string" || value === null)) clauses.push(identityCondition(model, field, value));
      else if (operator === "in" && Array.isArray(value) && value.every((part) => typeof part === "string")) clauses.push(positive(value));
      else if (operator === "notIn" && Array.isArray(value) && value.every((part) => typeof part === "string")) clauses.push({ NOT: positive(value) });
      else if (operator === "not") clauses.push({ NOT: identityCondition(model, field, value) });
      else throw new Error("Private identities support exact lookup only.");
    }
    return { AND: clauses };
  }

  function where(model: string, input: Row): Row {
    const result: Row = {};
    const clauses: Row[] = [];
    for (const [field, value] of Object.entries(input)) {
      if (identityLookupFields[model]?.[field]) clauses.push(identityCondition(model, field, value));
      else if (["AND", "OR", "NOT"].includes(field)) result[field] = mapOneOrMany(value, (part) => where(model, part));
      else if (relations[model]?.[field] && object(value)) {
        const target = relations[model][field];
        const relationFilter = Object.keys(value).some((key) => ["some", "every", "none", "is", "isNot"].includes(key));
        result[field] = relationFilter ? Object.fromEntries(Object.entries(value).map(([operator, part]) => [operator,
          ["some", "every", "none", "is", "isNot"].includes(operator) && object(part) ? where(target, part) : part,
        ])) : where(target, value);
      } else result[field] = value;
    }
    if (clauses.length) result.AND = [...(Array.isArray(result.AND) ? result.AND : result.AND ? [result.AND] : []), ...clauses];
    return result;
  }

  function uniqueWhere(model: string, input: Row): Row {
    const result: Row = { ...input };
    for (const [field, index] of Object.entries(identityLookupFields[model] ?? {})) {
      if (typeof input[field] === "string") { result[index] = lookup(model, field, input[field]); delete result[field]; }
    }
    return result;
  }

  function data(model: string, input: Row): Row {
    const result: Row = { ...input };
    for (const field of privateTextFields[model] ?? []) {
      if (!(field in input)) continue;
      const raw = object(input[field]) && "set" in input[field] ? input[field].set : input[field];
      if (raw !== null && raw !== undefined && typeof raw !== "string") throw new Error("Invalid private text write.");
      result[field] = typeof raw === "string" ? getCrypto().encryptText(raw, `${model}.${field}`) : raw;
      const index = identityLookupFields[model]?.[field];
      if (index) result[index] = typeof raw === "string" ? lookup(model, field, raw) : null;
    }
    for (const field of privateJsonFields[model] ?? []) {
      if (input[field] !== undefined && input[field] !== null && !(input[field] instanceof Prisma.NullTypes.DbNull) && !(input[field] instanceof Prisma.NullTypes.JsonNull)) {
        result[field] = { monoPrivate: getCrypto().encryptText(JSON.stringify(input[field]), `${model}.${field}`) };
      }
    }
    for (const field of privateBytesFields[model] ?? []) {
      if (input[field] instanceof Uint8Array) result[field] = Buffer.concat([PRIVATE_FILE_MAGIC, getCrypto().seal(input[field], `${model}.${field}`)]);
    }
    for (const [field, target] of Object.entries(relations[model] ?? {})) {
      if (!object(input[field])) continue;
      result[field] = Object.fromEntries(Object.entries(input[field]).map(([operation, value]) => {
        if (operation === "create") return [operation, mapOneOrMany(value, (part) => data(target, part))];
        if (operation === "createMany" && object(value)) return [operation, { ...value, data: mapOneOrMany(value.data, (part) => data(target, part)) }];
        if (["update", "updateMany", "upsert", "connectOrCreate"].includes(operation)) return [operation, mapOneOrMany(value, (part) => {
          if (!["data", "create", "update", "where"].some((key) => key in part)) return data(target, part);
          return args(target, part, operation);
        })];
        if (["connect", "disconnect", "delete", "set"].includes(operation)) return [operation, mapOneOrMany(value, (part) => uniqueWhere(target, part))];
        if (operation === "deleteMany") return [operation, mapOneOrMany(value, (part) => where(target, part))];
        return [operation, value];
      }));
    }
    return result;
  }

  function args(model: string, input: Row, operation: string): Row {
    const result: Row = { ...input };
    if (object(input.where)) result.where = ["findUnique", "findUniqueOrThrow", "upsert", "update", "delete", "connectOrCreate"].includes(operation)
      ? uniqueWhere(model, input.where) : where(model, input.where);
    for (const field of ["data", "create", "update"]) {
      if (input[field] !== undefined) result[field] = mapOneOrMany(input[field], (part) => data(model, part));
    }
    // Select/include shape stays identical; only nested filters are translated.
    for (const selection of ["select", "include"]) if (object(input[selection])) {
      result[selection] = Object.fromEntries(Object.entries(input[selection]).map(([field, value]) => [field,
        relations[model]?.[field] && object(value) ? args(relations[model][field], value, "findMany") : value,
      ]));
    }
    return result;
  }

  function decode(model: string, value: unknown): unknown {
    if (Array.isArray(value)) return value.map((row) => decode(model, row));
    if (!object(value)) return value;
    const result = { ...value };
    for (const field of privateTextFields[model] ?? []) if (typeof value[field] === "string") result[field] = getCrypto().decryptText(value[field], `${model}.${field}`);
    for (const field of privateJsonFields[model] ?? []) if (object(value[field]) && typeof value[field].monoPrivate === "string") result[field] = JSON.parse(getCrypto().decryptText(value[field].monoPrivate, `${model}.${field}`));
    for (const field of privateBytesFields[model] ?? []) if (value[field] instanceof Uint8Array) {
      const bytes = Buffer.from(value[field]);
      if (bytes.subarray(0, PRIVATE_FILE_MAGIC.length).equals(PRIVATE_FILE_MAGIC)) result[field] = new Uint8Array(getCrypto().open(bytes.subarray(PRIVATE_FILE_MAGIC.length), `${model}.${field}`));
    }
    for (const [field, target] of Object.entries(relations[model] ?? {})) if (field in value) result[field] = decode(target, value[field]);
    return result;
  }
  return { args, data, decode };
}

export function withPrivateData(client: PrismaClient, getCrypto: () => PrivateCrypto): PrismaClient {
  const codec = privateDataCodec(getCrypto);
  const extended = client.$extends({ name: "private-data-at-rest", query: { $allModels: {
    async $allOperations({ model, operation, args, query }) {
      const original = args as Row;
      const encoded = codec.args(model, original, operation);
      const identityLookup = object(original.where) && Object.keys(identityLookupFields[model] ?? {}).some((field) => typeof (original.where as Row)[field] === "string");
      let result: unknown;
      try {
        result = await query(encoded as typeof args);
        if (result === null && operation === "findUnique" && identityLookup) result = await query(original as typeof args);
      } catch (error) {
        if (operation === "findUniqueOrThrow" && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025" && identityLookup) {
          try { result = await query(original as typeof args); }
          catch (fallbackError) {
            if (fallbackError instanceof Error) { fallbackError.message = "Private database operation failed."; fallbackError.stack = `${fallbackError.name}: ${fallbackError.message}`; }
            throw fallbackError;
          }
        } else {
          // Avoid logging query arguments or private input in application error handlers.
          if (error instanceof Error) { error.message = "Private database operation failed."; error.stack = `${error.name}: ${error.message}`; }
          throw error;
        }
      }
      return codec.decode(model, result);
    },
  } } });
  // Storage representations change, while callers receive the original model shapes.
  return extended as unknown as PrismaClient;
}
