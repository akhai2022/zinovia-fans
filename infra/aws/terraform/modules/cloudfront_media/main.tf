# Origin Access Control (OAC) - recommended over OAI
resource "aws_cloudfront_origin_access_control" "s3" {
  name                              = "${var.name_prefix}-media-oac"
  description                       = "OAC for S3 media bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# RSA key pair for CloudFront signed URLs
resource "tls_private_key" "cloudfront" {
  algorithm = "RSA"
  rsa_bits  = 2048
}

resource "aws_cloudfront_public_key" "media" {
  name        = "${var.name_prefix}-media-pk"
  comment     = "Public key for media signed URLs"
  encoded_key = tls_private_key.cloudfront.public_key_pem
}

resource "aws_cloudfront_key_group" "media" {
  name    = "${var.name_prefix}-media-kg"
  comment = "Key group for media signed URLs"
  items   = [aws_cloudfront_public_key.media.id]
}

resource "aws_cloudfront_distribution" "media" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "Media CDN for ${var.name_prefix}"
  default_root_object = ""
  price_class         = "PriceClass_100"

  origin {
    domain_name              = var.s3_bucket_regional_domain_name
    origin_id                = "S3-${var.s3_bucket_id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.s3.id
  }

  default_cache_behavior {
    allowed_methods          = ["GET", "HEAD", "OPTIONS"]
    cached_methods           = ["GET", "HEAD"]
    target_origin_id         = "S3-${var.s3_bucket_id}"
    compress                 = true
    viewer_protocol_policy   = "redirect-to-https"
    cache_policy_id          = aws_cloudfront_cache_policy.media.id
    origin_request_policy_id = aws_cloudfront_origin_request_policy.range.id
    trusted_key_groups       = [aws_cloudfront_key_group.media.id]
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = var.acm_certificate_arn == null
    acm_certificate_arn            = var.acm_certificate_arn
    ssl_support_method             = var.acm_certificate_arn != null ? "sni-only" : null
    minimum_protocol_version       = var.acm_certificate_arn != null ? "TLSv1.2_2021" : null
  }

  aliases = var.domain_aliases

  dynamic "logging_config" {
    for_each = var.logs_bucket_domain != null ? [1] : []
    content {
      bucket          = var.logs_bucket_domain
      prefix          = var.logs_prefix
      include_cookies = false
    }
  }

  web_acl_id = var.web_acl_id

  tags = { Name = "${var.name_prefix}-media-cdn" }
}

# Cache policy: cache by URL, forward Range
resource "aws_cloudfront_cache_policy" "media" {
  name        = "${var.name_prefix}-media-cache"
  comment     = "Cache media with Range support"
  default_ttl = 86400
  max_ttl     = 31536000
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "whitelist"
      headers {
        items = ["Origin", "Range", "Accept"]
      }
    }
    query_strings_config {
      query_string_behavior = "all"
    }
    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true
  }
}

resource "aws_cloudfront_origin_request_policy" "range" {
  name    = "${var.name_prefix}-media-range"
  comment = "Forward Range for video"
  headers_config {
    header_behavior = "whitelist"
    headers {
      items = ["Range", "Origin"]
    }
  }
  query_strings_config {
    query_string_behavior = "all"
  }
  cookies_config {
    cookie_behavior = "none"
  }
}

# S3 bucket policy: allow CloudFront OAC only
data "aws_iam_policy_document" "s3_cloudfront" {
  statement {
    sid    = "AllowCloudFrontServicePrincipal"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    actions   = ["s3:GetObject"]
    resources = ["${var.s3_bucket_arn}/*"]
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.media.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "media" {
  bucket = var.s3_bucket_id
  policy = data.aws_iam_policy_document.s3_cloudfront.json
}
