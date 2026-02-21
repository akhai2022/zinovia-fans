/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AttachmentMeta } from './AttachmentMeta';
export type InboundEmailOut = {
    attachment_count: number;
    attachments_meta: Array<AttachmentMeta>;
    category: string;
    cc_addresses: Array<string>;
    created_at: string;
    forwarded_at: (string | null);
    forwarded_to: (string | null);
    from_address: string;
    id: string;
    is_read: boolean;
    received_at: string;
    resend_email_id: string;
    snippet: string;
    subject: string;
    to_addresses: Array<string>;
};

