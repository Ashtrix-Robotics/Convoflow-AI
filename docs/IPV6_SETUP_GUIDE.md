# IPv6 Configuration Setup Guide

## Status: ✅ COMPLETE

This guide documents the IPv6 configuration completed for the Convoflow AI backend infrastructure on AWS.

---

## Infrastructure Details

| Component                   | ID                         | Status                   |
| --------------------------- | -------------------------- | ------------------------ |
| **VPC**                     | `vpc-012e93a7375523285`    | ✅ Has IPv6 CIDR blocks  |
| **Subnet**                  | `subnet-0480e6a07145389bf` | ✅ IPv6 CIDR assigned    |
| **Network Interface (ENI)** | `eni-04ed18b3fb5d4f018`    | ✅ IPv6 address assigned |

---

## IPv6 Address Allocation

### VPC Level

The VPC has **two** IPv6 CIDR blocks allocated:

| CIDR Block                | Size                  | Status     | Purpose              |
| ------------------------- | --------------------- | ---------- | -------------------- |
| `2406:da1a:cfe:3600::/56` | /56 (256 /64 subnets) | Associated | Primary IPv6 space   |
| `2406:da1a:330:b800::/56` | /56 (256 /64 subnets) | Associated | Secondary IPv6 space |

### Subnet Level

The subnet has been assigned a /64 block from the primary VPC CIDR:

```
Subnet CIDR: 2406:da1a:cfe:3601::/64
```

**Note:** The first /64 block (`2406:da1a:cfe:3600::/64`) was already in use by another subnet, so the configuration script automatically selected the next available block.

### ENI Level

The primary network interface has been assigned a specific IPv6 address:

```
Primary IPv6: 2406:da1a:cfe:3601:536:2321:1f1a:8887
```

This address is within the subnet's /64 block and will be used for all IPv6 communication from the instance.

---

## Configuration Steps Completed

### 1. ✅ Subnet IPv6 Configuration

- Identified available /64 block from VPC's /56 allocation
- Automatically handled conflicts with existing assignments
- Associated `2406:da1a:cfe:3601::/64` to the subnet

### 2. ✅ ENI IPv6 Address Assignment

- Assigned IPv6 address from subnet's CIDR block
- Address: `2406:da1a:cfe:3601:536:2321:1f1a:8887`
- ENI is now dual-stack (IPv4 + IPv6)

### 3. 📋 Next Steps Required

The following steps should be completed by the infrastructure team:

#### A. Instance Network Configuration

```bash
# SSH into the instance and configure IPv6 on the OS level
# Ubuntu/Debian example:
sudo ip -6 addr add 2406:da1a:cfe:3601:536:2321:1f1a:8887/64 dev eth0
sudo ip -6 route add ::/0 via 2406:da1a:cfe:3601::1 dev eth0
```

#### B. Security Group Rules

- Review egress rules to ensure IPv6 traffic is allowed
- Add IPv6-specific rules if needed (`::/0` for all IPv6 traffic)

#### C. Network ACL (NACL) Rules

- If custom NACLs are in use, ensure IPv6 ICMP and related protocols are permitted

#### D. Route Table Configuration

- Ensure IPv6 routes are properly configured (usually automatic from IGW)
- Verify IPv6 route exists for Internet Gateway

#### E. Verify Connectivity

```bash
# Test IPv6 connectivity from the instance
ping6 2406:4700:4700::1111  # Cloudflare IPv6 DNS
curl -6 https://ipv6.google.com
```

---

## Scripts Available

### `scripts/configure-subnet-ipv6.py`

Automated script that:

- Detects the running instance and its subnet
- Assigns /64 IPv6 CIDR block from VPC's /56
- Handles conflicts by automatically selecting the next available block
- Assigns IPv6 address to the ENI

**Usage:**

```bash
python scripts/configure-subnet-ipv6.py
```

### `scripts/check-ipv6.py`

Diagnostic script that:

- Displays current IPv6 configuration
- Shows VPC's IPv6 blocks
- Lists subnet IPv6 assignments
- Shows ENI IPv6 addresses

**Usage:**

```bash
python scripts/check-ipv6.py
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│ AWS Region: ap-south-1 (Mumbai)                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ VPC: vpc-012e93a7375523285                      │ │
│ │ IPv6: 2406:da1a:cfe:3600::/56 (primary)         │ │
│ │ IPv6: 2406:da1a:330:b800::/56 (secondary)       │ │
│ │                                                 │ │
│ │ ┌───────────────────────────────────────────┐   │ │
│ │ │ Subnet: subnet-0480e6a07145389bf          │   │ │
│ │ │ IPv6 CIDR: 2406:da1a:cfe:3601::/64        │   │ │
│ │ │                                           │   │ │
│ │ │ ┌─────────────────────────────────────┐   │   │ │
│ │ │ │ EC2 Instance (running)              │   │   │ │
│ │ │ │ Primary ENI: eni-04ed18b3fb5d4f018  │   │   │ │
│ │ │ │ IPv4: 172.31.x.x                    │   │   │ │
│ │ │ │ IPv6: 2406:da1a:cfe:3601:...        │   │   │ │
│ │ │ │       :536:2321:1f1a:8887           │   │   │ │
│ │ │ └─────────────────────────────────────┘   │   │ │
│ │ │                                           │   │ │
│ │ │ ┌─────────────────────────────────────┐   │   │ │
│ │ │ │ Other Subnets (using other /64s)    │   │   │ │
│ │ │ │ - 2406:da1a:cfe:3600::/64           │   │   │ │
│ │ │ │ - (and up to 254 more)              │   │   │ │
│ │ │ └─────────────────────────────────────┘   │   │ │
│ │ └───────────────────────────────────────────┘   │ │
│ │                                                 │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## IPv6 CIDR Block Hierarchy

The /56 VPC allocation allows for up to 256 different /64 subnets:

```
2406:da1a:cfe:3600::/56  (VPC allocation)
├── 2406:da1a:cfe:3600::/64       (conflict - already in use)
├── 2406:da1a:cfe:3601::/64       ✅ (assigned to our subnet)
├── 2406:da1a:cfe:3602::/64
├── 2406:da1a:cfe:3603::/64
├── ...
└── 2406:da1a:cfe:36ff::/64       (last available)
```

Each /64 block can accommodate 2^64 - 2 IPv6 addresses (essentially unlimited for practical purposes).

---

## Troubleshooting

### Issue: "InvalidSubnet.Conflict" error

**Cause:** The /64 block is already assigned to another subnet.
**Solution:** The script automatically finds the next available /64 block.

### Issue: ENI IPv6 not showing in `ip -6 addr`

**Cause:** The OS network interface hasn't been configured yet.
**Solution:** Run OS-level network configuration (see "Next Steps Required" section).

### Issue: No external IPv6 connectivity

**Cause:** Route table doesn't have IPv6 routes configured.
**Solution:** Check that Internet Gateway has IPv6 route pointing to `::/0`.

### Issue: "PythonDeprecationWarning" when running scripts

**Cause:** Python 3.9 is used, but AWS SDKs recommend Python 3.10+.
**Solution:** Not critical for current functionality, but upgrade Python when possible.

---

## Verification Commands

Run these on the EC2 instance after OS-level configuration:

```bash
# Check IPv6 address assignment
ip -6 addr show

# Check IPv6 routes
ip -6 route show

# Test IPv6 connectivity
ping6 -c 3 2406:4700:4700::1111

# Check DNS resolution over IPv6
getent ahosts google.com | grep IPv6

# View socket listening on IPv6
ss -6 -l

# Test with curl
curl -6 http://ipv6.example.com
```

---

## Related Files

- **Configuration scripts:** `scripts/configure-subnet-ipv6.py`, `scripts/check-ipv6.py`
- **Backend API:** `backend/app/main.py`
- **Docker setup:** `backend/Dockerfile`
- **Nginx config:** (if applicable for reverse proxy)

---

## References

- [AWS VPC IPv6 Support](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-ipv6.html)
- [AWS Subnet CIDR Blocks](https://docs.aws.amazon.com/vpc/latest/userguide/configure-subnets.html)
- [IPv6 CIDR Notation](https://en.wikipedia.org/wiki/Classless_Inter-Domain_Routing#IPv6)
- [Linux IPv6 Configuration](https://wiki.debian.org/IPv6)

---

**Last Updated:** 2024
**Configuration Date:** [Current Session]
**Status:** Ready for OS-level configuration
