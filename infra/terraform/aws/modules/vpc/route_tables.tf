# =============================================================================
# Route Tables
# =============================================================================

# Route table for Internet Gateway
resource "aws_route_table" "route_table_igw" {
  count = var.create_internet_gateway ? 1 : 0

  vpc_id = aws_vpc.vpc.id
  tags = {
    Name = "${var.name}-igw-rt"
  }
}

# Route for Internet Gateway
resource "aws_route" "global_igw" {
  count = var.create_internet_gateway ? 1 : 0

  route_table_id         = aws_route_table.route_table_igw[count.index].id
  gateway_id             = aws_internet_gateway.igw[count.index].id
  destination_cidr_block = "0.0.0.0/0"
}

# Route table for NAT Gateway
resource "aws_route_table" "route_table_nat" {
  count = var.create_nat_gateway ? 1 : 0

  vpc_id = aws_vpc.vpc.id
  tags = {
    Name = "${var.name}-nat-rt"
  }
}

# Route for NAT Gateway
resource "aws_route" "global_nat" {
  count = var.create_nat_gateway ? 1 : 0

  route_table_id         = aws_route_table.route_table_nat[count.index].id
  nat_gateway_id         = aws_nat_gateway.nat[count.index].id
  destination_cidr_block = "0.0.0.0/0"
}

# Route tables for subnets
resource "aws_route_table" "route_tables" {
  for_each = var.route_tables
  vpc_id   = aws_vpc.vpc.id
  tags = {
    Name = "${var.name}-${each.key}-rt"
  }
}

# Route table associations
resource "aws_route_table_association" "route_table_associations" {
  for_each = var.route_tables

  subnet_id      = each.value.subnet_id
  route_table_id = each.value.route_table_id
}
