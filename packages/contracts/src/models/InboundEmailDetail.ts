/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AttachmentMeta } from './AttachmentMeta';
/**
 * Full email detail including bodies and headers.
 */
export type InboundEmailDetail = {
    attachment_count: number;
    attachments_meta: Array<AttachmentMeta>;
    category: string;
    cc_addresses: Array<string>;
    created_at: string;
    dkim_result: (string | null);
    forwarded_at: (string | null);
    forwarded_to: (string | null);
    from_address: string;
    headers: (Record<string, any> | null);
    html_body: (string | null);
    id: string;
    is_read: boolean;
    message_id_header: (string | null);
    raw_download_expires_at: (string | null);
    raw_download_url: (string | null);
    received_at: string;
    reply_to_addresses: Array<string>;
    resend_email_id: string;
    snippet: string;
    spam_score: (string | null);
    spf_result: (string | null);
    subject: string;
    text_body: (string | null);
    to_addresses: Array<string>;
};

