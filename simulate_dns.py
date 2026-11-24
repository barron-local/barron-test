#!/usr/bin/env python3
"""
DNS Simulator & Server for DevOps Competition
จำลองและทำหน้าที่เป็น DNS Server จริง (RFC 1035 UDP Port 53)
ตอบกลับโดเมน *.group3.vec (frontend, backend, gitlab, registry, app) ด้วย IP ที่กำหนด
"""

import socket
import sys

def build_dns_response(data, server_ip):
    # Transaction ID (2 bytes)
    transaction_id = data[:2]
    # Flags: Standard query response, No error (0x8180)
    flags = b"\x81\x80"
    # QDCOUNT (Questions count: 1)
    qdcount = data[4:6]
    # ANCOUNT (Answers count: 1)
    ancount = b"\x00\x01"
    # NSCOUNT & ARCOUNT (0)
    nscount = b"\x00\x00"
    arcount = b"\x00\x00"

    # Header (12 bytes)
    header = transaction_id + flags + qdcount + ancount + nscount + arcount

    # Extract Question
    question = b""
    idx = 12
    while idx < len(data) and data[idx] != 0:
        length = data[idx]
        idx += length + 1
    idx += 1 # null byte
    qtype_qclass = data[idx:idx+4]
    question = data[12:idx+4]

    # Answer: Pointer to domain name in question (0xc00c)
    ans_name = b"\xc0\x0c"
    ans_type = b"\x00\x01" # Type A
    ans_class = b"\x00\x01" # Class IN
    ans_ttl = b"\x00\x00\x00\x3c" # TTL 60s
    ans_data_len = b"\x00\x04" # IP length 4 bytes
    ans_ip = bytes([int(x) for x in server_ip.split('.')])

    answer = ans_name + ans_type + ans_class + ans_ttl + ans_data_len + ans_ip
    return header + question + answer

def main():
    server_ip = sys.argv[1] if len(sys.argv) > 1 else "192.168.110.129"
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 53

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.bind(("0.0.0.0", port))
        print(f"[DNS Server Running] Listening on UDP port {port} -> Resolving all *.group3.vec to {server_ip}")
    except PermissionError:
        print(f"Error: Port {port} requires root/administrator privileges.")
        sys.exit(1)

    while True:
        try:
            data, addr = sock.recvfrom(512)
            response = build_dns_response(data, server_ip)
            sock.sendto(response, addr)
            print(f"[Query Resolved] Client {addr[0]}:{addr[1]} -> {server_ip}")
        except Exception as e:
            print("Error handling packet:", e)

if __name__ == "__main__":
    main()
