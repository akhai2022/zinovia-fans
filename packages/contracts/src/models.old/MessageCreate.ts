/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { MessageCreateMediaLock } from './MessageCreateMediaLock';
/**
 * TEXT: type=TEXT, text required. MEDIA: type=MEDIA, media_ids required; lock optional (creator only).
 */
export type MessageCreate = {
    lock?: (MessageCreateMediaLock | null);
    media_ids?: (Array<string> | null);
    text?: (string | null);
    type: string;
};

