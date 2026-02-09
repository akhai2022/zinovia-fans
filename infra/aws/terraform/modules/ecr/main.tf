resource "aws_ecr_repository" "api" {
  name                 = "${var.name_prefix}-api"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }
  tags = { Name = "${var.name_prefix}-api" }
}

resource "aws_ecr_repository" "web" {
  name                 = "${var.name_prefix}-web"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }
  tags = { Name = "${var.name_prefix}-web" }
}

resource "aws_ecr_repository" "worker" {
  name                 = "${var.name_prefix}-worker"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }
  tags = { Name = "${var.name_prefix}-worker" }
}
