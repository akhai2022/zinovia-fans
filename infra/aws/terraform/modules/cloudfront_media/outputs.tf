output "distribution_id" {
  value = aws_cloudfront_distribution.media.id
}

output "distribution_arn" {
  value = aws_cloudfront_distribution.media.arn
}

output "distribution_domain_name" {
  value = aws_cloudfront_distribution.media.domain_name
}

output "distribution_hosted_zone_id" {
  value = aws_cloudfront_distribution.media.hosted_zone_id
}

output "distribution_url" {
  value = "https://${aws_cloudfront_distribution.media.domain_name}"
}
