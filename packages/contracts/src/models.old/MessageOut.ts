/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { MessageMediaOut } from './MessageMediaOut';
export type MessageOut = {
    conversation_id: string;
    created_at: string;
    id: string;
    media?: Array<MessageMediaOut>;
    message_type: string;
    sender_id: string;
    sender_role: string;
    text?: (string | null);
};

