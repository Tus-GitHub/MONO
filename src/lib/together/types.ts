import type { SavedCrop } from "@/lib/images/saved-crop";
import type { GameKind, GameState } from "./games";
import type { SoloScore } from "@/lib/solo-games/catalog";
export interface MessageDTO { generation?: number; id: string; sequence: string; senderId: string; kind: "TEXT" | "STICKER" | "IMAGE" | "DOCUMENT" | "VIDEO" | "GAME"; body: string; gameId: string | null; createdAt: string; clientNonce: string; encrypted: boolean; version: number; editedAt: string | null; deleted: boolean; hidden: boolean; image: { url: string; width: number; height: number; contentType: string; encrypted: boolean; viewLimit: number; viewsUsed: number; crop?: SavedCrop | null } | null }
export interface GameDTO { rematchRequestedById?: string | null; rematchRequestedAt?: string | null; rematchGameId?: string | null; id: string; kind: GameKind; status: "WAITING" | "ACTIVE" | "FINISHED" | "DECLINED" | "CANCELLED"; playerOneId: string; playerTwoId: string; winnerId: string | null; state: GameState; version: number; createdAt: string; updatedAt: string }
export interface GameHistoryPage { games: GameDTO[]; nextCursor: string | null }
export interface ScoreDTO { kind: GameKind; userId: string; wins: number; losses: number; draws: number }
export interface ChatPeer { id: string; name: string; avatarUrl: string | null; lastRead: string; lastSeenAt: string | null; typingUntil: string | null }
export interface TogetherSnapshot { chatGeneration?: number; revision: string; cursor: string; messages: MessageDTO[]; updates?: MessageDTO[]; coupleId: string; chatKeyId: string | null; games?: GameDTO[]; scores?: ScoreDTO[]; soloScores?: SoloScore[]; imageBytes?: number; partner: ChatPeer; hasMore: boolean; timezone: string; observedAt: string }
export interface CallDTO { id: string; callerId: string; calleeId: string; kind: "AUDIO" | "VIDEO"; status: "RINGING" | "ACCEPTED" | "ENDED" | "DECLINED" | "MISSED"; createdAt: string; acceptedAt: string | null }
export interface SignalDTO { id: string; kind: "offer" | "answer" | "ice" | "restart"; payload: RTCSessionDescriptionInit | RTCIceCandidateInit }
