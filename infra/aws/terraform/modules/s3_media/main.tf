resource "aws_s3_bucket" "media" {
  bucket = "${var.name_prefix}-${substr(md5(var.name_prefix), 0, 8)}"
  tags   = { Name = "${var.name_prefix}-media" }
}

resource "aws_s3_bucket_versioning" "media" {
  bucket = aws_s3_bucket.media.id
  versioning_configuration {
    status = var.versioning ? "Enabled" : "Suspended"
  }
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket = aws_s3_bucket.media.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "media" {
  count  = var.lifecycle_days > 0 ? 1 : 0
  bucket = aws_s3_bucket.media.id
  rule {
    id     = "expire-old"
    status = "Enabled"
    filter {} # Apply to all objects (required in AWS provider 5.x)
    expiration { days = var.lifecycle_days }
  }
}

# Server access logging (P1-6). Use enable_logging to avoid count depending on computed values.
resource "aws_s3_bucket_logging" "media" {
  count         = var.enable_logging ? 1 : 0
  bucket        = aws_s3_bucket.media.id
  target_bucket = var.logs_bucket_id
  target_prefix = "s3-media/"
}

# CORS for presigned PUT uploads and Range requests (MP4)
resource "aws_s3_bucket_cors_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  cors_rule {
    allowed_headers = ["*", "Content-Type", "x-amz-*", "Authorization"]
    allowed_methods = ["GET", "HEAD", "PUT", "POST"]
    allowed_origins = [
      "https://zinovia.ai",
      "https://www.zinovia.ai",
      "https://app.zinovia.ai",
      "https://stg-app.zinovia.ai",
      "https://stg-api.zinovia.ai",
      "http://localhost:3000",
      "http://127.0.0.1:3000"
    ]
    expose_headers  = ["ETag", "x-amz-request-id", "x-amz-id-2", "Content-Type", "Content-Length", "Content-Range", "Accept-Ranges"]
    max_age_seconds = 3600
  }
}
