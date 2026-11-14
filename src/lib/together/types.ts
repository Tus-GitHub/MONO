import type { GameKind, GameState } from "./games";
export interface MessageDTO { id: string; sequence: string; senderId: string; kind: "TEXT" | "STICKER" | "IMAGE" | "GAME"; body: string; gameId: string | null; createdAt: string; image: { url: string; width: number; height: number } | null }
export interface GameDTO { id: string; kind: GameKind; status: "WAITING" | "ACTIVE" | "FINISHED" | "DECLINED" | "CANCELLED"; playerOneId: string; playerTwoId: string; winnerId: string | null; state: GameState; version: number; createdAt: string }
export interface ScoreDTO { kind: GameKind; userId: string; wins: number; losses: number; draws: number }
export interface ChatPeer { id: string; name: string; avatarUrl: string | null; lastRead: string; lastSeenAt: string | null; typingUntil: string | null }
export interface TogetherSnapshot { revision: string; cursor: string; messages: MessageDTO[]; games?: GameDTO[]; scores?: ScoreDTO[]; imageBytes?: number; partner: ChatPeer; hasMore: boolean; timezone: string; observedAt: string }
export interface CallDTO { id: string; callerId: string; calleeId: string; kind: "AUDIO" | "VIDEO"; status: "RINGING" | "ACCEPTED" | "ENDED" | "DECLINED" | "MISSED"; createdAt: string; acceptedAt: string | null }
export interface SignalDTO { id: string; kind: "offer" | "answer" | "ice"; payload: RTCSessionDescriptionInit | RTCIceCandidateInit }
