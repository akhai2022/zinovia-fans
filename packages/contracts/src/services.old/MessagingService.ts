/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ConversationCreate } from '../models/ConversationCreate';
import type { ConversationListOut } from '../models/ConversationListOut';
import type { MessageCreate } from '../models/MessageCreate';
import type { MessageOut } from '../models/MessageOut';
import type { MessagePageOut } from '../models/MessagePageOut';
import type { SignedUrlResponse } from '../models/SignedUrlResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class MessagingService {
    /**
     * Get Conversations
     * @returns ConversationListOut Successful Response
     * @throws ApiError
     */
    public static getConversationsDmConversationsGet(): CancelablePromise<ConversationListOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/dm/conversations',
        });
    }
    /**
     * Create Conversation
     * @param requestBody
     * @returns any Successful Response
     * @throws ApiError
     */
    public static dmCreateConversation(
        requestBody: ConversationCreate,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/dm/conversations',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Conversation Messages
     * @param conversationId
     * @param cursor
     * @param pageSize
     * @returns MessagePageOut Successful Response
     * @throws ApiError
     */
    public static getConversationMessagesDmConversationsConversationIdMessagesGet(
        conversationId: string,
        cursor?: (string | null),
        pageSize: number = 50,
    ): CancelablePromise<MessagePageOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/dm/conversations/{conversation_id}/messages',
            path: {
                'conversation_id': conversationId,
            },
            query: {
                'cursor': cursor,
                'page_size': pageSize,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Post Message
     * @param conversationId
     * @param requestBody
     * @returns MessageOut Successful Response
     * @throws ApiError
     */
    public static postMessageDmConversationsConversationIdMessagesPost(
        conversationId: string,
        requestBody: MessageCreate,
    ): CancelablePromise<MessageOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/dm/conversations/{conversation_id}/messages',
            path: {
                'conversation_id': conversationId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Dm Message Media Download Url
     * @param messageMediaId
     * @param variant
     * @returns SignedUrlResponse Successful Response
     * @throws ApiError
     */
    public static dmMessageMediaDownloadUrl(
        messageMediaId: string,
        variant?: (string | null),
    ): CancelablePromise<SignedUrlResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/dm/message-media/{message_media_id}/download-url',
            path: {
                'message_media_id': messageMediaId,
            },
            query: {
                'variant': variant,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Dm Media Download Url
     * @param messageId
     * @param mediaId
     * @param variant
     * @returns SignedUrlResponse Successful Response
     * @throws ApiError
     */
    public static dmMediaDownloadUrl(
        messageId: string,
        mediaId: string,
        variant?: (string | null),
    ): CancelablePromise<SignedUrlResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/dm/messages/{message_id}/media/{media_id}/download-url',
            path: {
                'message_id': messageId,
                'media_id': mediaId,
            },
            query: {
                'variant': variant,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
