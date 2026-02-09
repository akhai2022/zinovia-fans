output "api_repository_url" {
  value = aws_ecr_repository.api.repository_url
}

output "web_repository_url" {
  value = aws_ecr_repository.web.repository_url
}

output "worker_repository_url" {
  value = aws_ecr_repository.worker.repository_url
}

output "api_repository_arn" {
  value = aws_ecr_repository.api.arn
}

output "web_repository_arn" {
  value = aws_ecr_repository.web.arn
}

output "worker_repository_arn" {
  value = aws_ecr_repository.worker.arn
}
