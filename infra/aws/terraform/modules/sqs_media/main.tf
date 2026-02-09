resource "aws_sqs_queue" "dlq" {
  name                      = "${var.name_prefix}-media-jobs-dlq"
  message_retention_seconds = 1209600 # 14 days
  tags                      = { Name = "${var.name_prefix}-media-jobs-dlq" }
}

resource "aws_sqs_queue" "main" {
  name                       = "${var.name_prefix}-media-jobs"
  message_retention_seconds  = var.message_retention_seconds
  visibility_timeout_seconds = var.visibility_timeout_seconds
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 3
  })
  tags = { Name = "${var.name_prefix}-media-jobs" }
}
