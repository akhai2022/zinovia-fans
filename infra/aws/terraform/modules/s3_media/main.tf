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

# CORS for signed URLs and Range requests (MP4)
resource "aws_s3_bucket_cors_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["Content-Type", "Content-Length", "Content-Range", "Accept-Ranges", "ETag"]
    max_age_seconds = 3600
  }
}
