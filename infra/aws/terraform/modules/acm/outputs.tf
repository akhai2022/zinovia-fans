output "certificate_arn" {
  value       = aws_acm_certificate.cert.arn
  description = "Cert ARN; only usable by CloudFront/ALB after status is ISSUED (ensure DNS validation records exist)."
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
