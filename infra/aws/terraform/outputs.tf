output "api_url" {
  value       = var.enable_alb ? (var.enable_custom_domain ? "https://${local.api_domain}" : "http://${aws_lb.main[0].dns_name}") : "http://<task-public-ip>:8000"
  description = "API URL: ALB DNS when enable_alb and no custom domain; custom domain when dns; else public ECS placeholder (use api_url_cli)."
}

output "api_url_cli" {
  value       = var.enable_alb ? null : "From repo root: API_BASE_URL=$(./scripts/deploy/aws/get_api_url.sh) ./scripts/deploy/aws/build_and_push.sh"
  description = "Get temporary API URL: run get_api_url.sh, then build web with that as NEXT_PUBLIC_API_BASE_URL."
}

output "app_url" {
  value       = var.enable_custom_domain ? (var.web_use_apex ? "https://${var.domain_name}" : "https://${local.app_domain}") : null
  description = "Web app URL (zinovia.ai when web_use_apex, else app.zinovia.ai)."
}

output "web_url" {
  value       = var.enable_alb ? (var.enable_custom_domain ? (var.web_use_apex ? "https://${var.domain_name}" : "https://${local.app_domain}") : "http://${aws_lb.main[0].dns_name}") : try("https://${aws_cloudfront_distribution.web[0].domain_name}", "N/A - set enable_cloudfront when account verified")
  description = "Web app URL: zinovia.ai when web_use_apex, else app subdomain; ALB DNS when no custom domain."
}

output "media_cdn_url" {
  value       = var.enable_custom_domain ? "https://${local.media_domain}" : try("https://${module.cloudfront_media[0].distribution_domain_name}", "N/A - set enable_cloudfront when account verified")
  description = "Media CDN URL: custom domain or CloudFront default (N/A when enable_cloudfront = false)."
}

output "cdn_base_url" {
  value       = var.enable_custom_domain ? "https://${local.media_domain}" : try("https://${module.cloudfront_media[0].distribution_domain_name}", "N/A - set enable_cloudfront when account verified")
  description = "CDN base URL for media (use for CDN_BASE_URL env). N/A when enable_cloudfront = false."
}

output "vpc_id" {
  value       = local.vpc_id
  description = "VPC ID (dedicated new VPC when use_existing_vpc = false). Verify != default VPC (e.g. vpc-0f645619e2e32d202)."
}

output "nat_gateway_ids" {
  value       = local.nat_gateway_ids
  description = "NAT gateway IDs (empty when use_existing_vpc = true)"
}

output "public_subnet_ids" {
  value       = local.public_subnet_ids
  description = "Public subnet IDs (ALB)"
}

output "migrate_task_definition" {
  value       = aws_ecs_task_definition.migrate.family
  description = "ECS task definition family for one-off migrations (run-task)"
}

output "alb_dns_name" {
  value       = var.enable_alb ? aws_lb.main[0].dns_name : null
  description = "ALB DNS name (when enable_alb = true)"
}

output "rds_endpoint" {
  value       = module.rds.endpoint
  description = "RDS endpoint (host:port)"
}

output "ecr_api_url" {
  value       = module.ecr.api_repository_url
  description = "ECR API repository URL"
}

output "ecr_web_url" {
  value       = module.ecr.web_repository_url
  description = "ECR Web repository URL"
}

output "ecr_worker_url" {
  value       = module.ecr.worker_repository_url
  description = "ECR Worker repository URL"
}

output "media_bucket_id" {
  value       = module.s3_media.bucket_id
  description = "S3 media bucket name"
}

output "redis_url" {
  value       = local.redis_url
  description = "Redis URL for Celery broker (ElastiCache)"
}

output "ecs_cluster_name" {
  value       = aws_ecs_cluster.main.name
  description = "ECS cluster name"
}

output "ecs_api_service_name" {
  value       = var.enable_alb ? aws_ecs_service.api[0].name : aws_ecs_service.api_no_alb[0].name
  description = "ECS API service name"
}

output "ecs_web_service_name" {
  value       = var.enable_alb ? aws_ecs_service.web[0].name : null
  description = "ECS Web service name (when ALB enabled)"
}

output "ecs_worker_service_name" {
  value       = aws_ecs_service.worker.name
  description = "ECS Worker service name"
}

output "aws_region" {
  value       = var.aws_region
  description = "AWS region"
}

output "cloudfront_distribution_id" {
  value       = try(module.cloudfront_media[0].distribution_id, null)
  description = "CloudFront distribution ID for media (null when enable_cloudfront = false)"
}

output "private_subnet_ids" {
  value       = local.private_subnet_ids
  description = "Private subnet IDs for ECS tasks (e.g. migration run-task)"
}

output "ecs_security_group_id" {
  value       = local.ecs_security_group_id
  description = "Security group ID for ECS tasks"
}

# -----------------------------------------------------------------------------
# DNS delegation and ACM validation (when dns_delegated = false)
# -----------------------------------------------------------------------------
output "route53_nameservers" {
  value       = (var.enable_route53 || var.enable_acm) && local.zone_id != "" ? (var.route53_zone_id != "" ? data.aws_route53_zone.by_id[0].name_servers : data.aws_route53_zone.main[0].name_servers) : []
  description = "Route53 hosted zone name servers. Delegate zinovia.ai to these at your registrar, then set dns_delegated = true and re-apply."
}

output "acm_validation_records_alb" {
  value       = var.enable_alb && var.enable_acm && !var.dns_delegated ? try(module.acm_alb[0].validation_options, []) : []
  description = "ACM DNS validation records for ALB cert. Create these CNAME records (at registrar or current DNS) so the certificate can validate. Then set dns_delegated = true and re-apply to create A records."
}

output "acm_validation_records_cloudfront" {
  value       = var.enable_acm && !var.dns_delegated ? try(module.acm_cloudfront[0].validation_options, []) : []
  description = "ACM DNS validation records for CloudFront media cert (us-east-1). Create these CNAME records for certificate validation."
}

output "acm_validation_records_apex" {
  value       = var.enable_apex_cloudfront && !var.web_use_apex && !var.dns_delegated ? try(module.acm_apex[0].validation_options, []) : []
  description = "ACM DNS validation records for apex+www cert (us-east-1: zinovia.ai, www.zinovia.ai). Create these CNAME records, then set dns_delegated = true and re-apply."
}

output "apex_cloudfront_domain" {
  value       = var.enable_apex_cloudfront && !var.web_use_apex ? aws_cloudfront_distribution.apex[0].domain_name : null
  description = "CloudFront distribution domain for apex (zinovia.ai and www.zinovia.ai)."
}

