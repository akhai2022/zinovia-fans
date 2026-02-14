output "certificate_arn" {
  value       = aws_acm_certificate.cert.arn
  description = "Cert ARN; only usable by CloudFront/ALB after status is ISSUED (ensure DNS validation records exist)."
}

# Use this for HTTPS listener: only non-null after DNS validation completes (when wait_for_validation=true).
output "certificate_arn_validated" {
  value       = var.create_validation_records && var.wait_for_validation ? aws_acm_certificate_validation.cert[0].certificate_arn : null
  description = "Cert ARN after validation completes. Null when wait_for_validation=false; use for HTTPS listener to avoid PENDING_VALIDATION errors."
}

output "validation_options" {
  value = [
    for dvo in aws_acm_certificate.cert.domain_validation_options : {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      value  = dvo.resource_record_value
      domain = dvo.domain_name
    }
  ]
  description = "ACM DNS validation records (create these at your DNS when create_validation_records = false)."
}
