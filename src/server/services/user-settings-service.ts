import "server-only";

import { prisma } from "@/lib/db/prisma";
import { DEFAULT_THEME, isTheme, type Theme } from "@/lib/settings/theme";
import type { UserSettingsInput } from "@/lib/validation/settings";

export interface UserSettings {
  theme: Theme;
  hideMoneyInsights: boolean;
  hidePartnerPreferenceGap: boolean;
}

export async function getUserSettings(userId: string): Promise<UserSettings> {
  const row = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { theme: true, hideMoneyInsights: true, hidePartnerPreferenceGap: true },
  });
  return {
    theme: isTheme(row.theme) ? row.theme : DEFAULT_THEME,
    hideMoneyInsights: row.hideMoneyInsights,
    hidePartnerPreferenceGap: row.hidePartnerPreferenceGap,
  };
}

export async function updateUserSettings(
  userId: string,
  input: UserSettingsInput,
): Promise<UserSettings> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      theme: input.theme,
      hideMoneyInsights: input.hideMoneyInsights,
      hidePartnerPreferenceGap: input.hidePartnerPreferenceGap,
    },
    select: { id: true },
  });
  return input;
}

export async function setUserTheme(userId: string, theme: Theme): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { theme },
    select: { id: true },
  });
}
