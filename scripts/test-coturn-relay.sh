#!/usr/bin/env bash
# Regression lock: coturn must carry relay↔relay media (not just ChannelBind).
# Usage: ./scripts/test-coturn-relay.sh
# Exit 0 = pass, 1 = fail. Safe after any coturn conf change.
set -euo pipefail

HOST="${HOST:-root@209.38.204.153}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/ruletka_ed25519}"
SSH=(ssh -i "$SSH_KEY" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=12)

echo "== coturn relay-to-relay media lock =="

# Remote script as base64 to avoid nested-quote breakage.
REMOTE_PY=$(base64 -w0 <<'PY'
import hashlib, hmac, os, socket, struct, time, base64, zlib, sys

secret = [l.split("=",1)[1].strip() for l in open("/opt/ruletka/data/turn.env") if l.startswith("ROULETTE_TURN_SECRET=")][0].encode()
HOST, PORT = "127.0.0.1", 3478

def tid():
    return os.urandom(12)

def attr(atype, value):
    pad = (4 - (len(value) % 4)) % 4
    return struct.pack("!HH", atype, len(value)) + value + b"\x00" * pad

def parse(msg):
    mtype, mlen = struct.unpack("!HH", msg[:4])
    body = msg[20:20 + mlen]
    attrs = {}
    i = 0
    while i + 4 <= len(body):
        at, al = struct.unpack("!HH", body[i:i + 4])
        i += 4
        val = body[i:i + al]
        i += al + ((4 - (al % 4)) % 4)
        attrs[at] = val
    return mtype, attrs

def xor_decode(val):
    _, xport = struct.unpack("!HH", val[:4])
    port = xport ^ (0x2112A442 >> 16)
    xip = struct.unpack("!I", val[4:8])[0]
    return socket.inet_ntoa(struct.pack("!I", xip ^ 0x2112A442)), port

def xor_peer(ip, port):
    xport = port ^ (0x2112A442 >> 16)
    xip = struct.unpack("!I", socket.inet_aton(ip))[0] ^ 0x2112A442
    return attr(0x0012, struct.pack("!HHI", 0x01, xport, xip))

def add_auth(msg_type, base_attrs, username, realm, nonce, key):
    transaction_id = tid()
    attrs = list(base_attrs) + [attr(0x0006, username), attr(0x0014, realm), attr(0x0015, nonce)]
    body = b"".join(attrs)
    header_mi = struct.pack("!HHI", msg_type, len(body) + 24, 0x2112A442) + transaction_id
    mi = hmac.new(key, header_mi + body, hashlib.sha1).digest()
    body_mi = body + attr(0x0008, mi)
    header = struct.pack("!HHI", msg_type, len(body_mi) + 8, 0x2112A442) + transaction_id
    msg = header + body_mi
    crc = zlib.crc32(msg) & 0xffffffff ^ 0x5354554e
    return msg + attr(0x8028, struct.pack("!I", crc))

def recv_stun(sock, timeout=3.0):
    sock.settimeout(timeout)
    end = time.time() + timeout
    while time.time() < end:
        data = sock.recv(4096)
        if len(data) >= 20 and (data[0] & 0xC0) == 0:
            return parse(data)
    raise TimeoutError("stun timeout")

def allocate(sock, uname):
    t = tid()
    body = attr(0x0019, bytes([17, 0, 0, 0]))
    header = struct.pack("!HHI", 0x0003, len(body) + 8, 0x2112A442) + t
    msg = header + body
    crc = zlib.crc32(msg) & 0xffffffff ^ 0x5354554e
    sock.send(msg + attr(0x8028, struct.pack("!I", crc)))
    mtype, attrs = recv_stun(sock)
    realm, nonce = attrs[0x0014], attrs[0x0015]
    password = base64.b64encode(hmac.new(secret, uname, hashlib.sha1).digest())
    key = hashlib.md5(uname + b":" + realm + b":" + password).digest()
    sock.send(add_auth(0x0003, [attr(0x0019, bytes([17, 0, 0, 0]))], uname, realm, nonce, key))
    mtype, attrs = recv_stun(sock)
    if mtype != 0x0103:
        print("FAIL: allocate", hex(mtype))
        sys.exit(1)
    return uname, realm, nonce, key, xor_decode(attrs[0x0016])

def bind_peer(sock, username, realm, nonce, key, peer_ip, peer_port, ch):
    peer = xor_peer(peer_ip, peer_port)
    sock.send(add_auth(0x0008, [peer], username, realm, nonce, key))
    if recv_stun(sock)[0] != 0x0108:
        print("FAIL: CREATE_PERM")
        sys.exit(1)
    sock.send(add_auth(0x0009, [attr(0x000C, struct.pack("!HH", ch, 0)), peer], username, realm, nonce, key))
    if recv_stun(sock)[0] != 0x0109:
        print("FAIL: CHANNEL_BIND")
        sys.exit(1)

def cdata(ch, data):
    pad = (4 - (len(data) % 4)) % 4
    return struct.pack("!HH", ch, len(data)) + data + b"\x00" * pad

exp = int(time.time()) + 3600
s1 = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s1.settimeout(3)
s1.connect((HOST, PORT))
s2 = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s2.settimeout(3)
s2.connect((HOST, PORT))
u1, r1, n1, k1, relay1 = allocate(s1, f"{exp}:lock1".encode())
u2, r2, n2, k2, relay2 = allocate(s2, f"{exp}:lock2".encode())
bind_peer(s1, u1, r1, n1, k1, relay2[0], relay2[1], 0x4000)
bind_peer(s2, u2, r2, n2, k2, relay1[0], relay1[1], 0x4000)
payload = b"LOCK_MEDIA_"
for i in range(20):
    s1.send(cdata(0x4000, payload + f"{i:02d}".encode()))
    s2.send(cdata(0x4000, payload + f"{i:02d}".encode()))
    time.sleep(0.02)
recv1 = recv2 = b1 = b2 = 0
end = time.time() + 2.0
s1.settimeout(0.2)
s2.settimeout(0.2)
while time.time() < end:
    for s, side in ((s1, 1), (s2, 2)):
        try:
            data = s.recv(4096)
        except socket.timeout:
            continue
        if len(data) >= 4 and (data[0] & 0xC0) != 0:
            _, ln = struct.unpack("!HH", data[:4])
            if side == 1:
                recv1 += 1
                b1 += ln
            else:
                recv2 += 1
                b2 += ln
print(f"dual-relay media: recv1={recv1} bytes1={b1} recv2={recv2} bytes2={b2}")
if recv1 < 1 or recv2 < 1 or b1 < 1 or b2 < 1:
    print("FAIL: relay-to-relay ChannelData not delivered (peer_usage path broken)")
    conf = open("/etc/turnserver.conf").read()
    if "/10." in conf:
        print("hint: external-ip=PUBLIC/VPC_PRIVATE rewrites peers to VPC while sockets bind public")
    sys.exit(1)
print("PASS: self-peer ChannelBind + dual-relay media both ways")
PY
)

out=$("${SSH[@]}" "$HOST" "set -e
SECRET=\$(grep ROULETTE_TURN_SECRET /opt/ruletka/data/turn.env | cut -d= -f2)
PUBLIC=\$(grep -E '^external-ip=' /etc/turnserver.conf | head -1 | sed 's|.*=||;s|/.*||')
MAP=\$(grep -E '^external-ip=' /etc/turnserver.conf | head -1)
EXP=\$((\$(date +%s)+3600))
U=\"\${EXP}:web\"
P=\$(printf %s \"\$U\" | openssl dgst -sha1 -hmac \"\$SECRET\" -binary | base64)
echo \"external-ip line: \$MAP\"
echo \"public=\$PUBLIC\"
echo -n \"self-peer ChannelBind: \"
timeout 6 turnutils_uclient -v -u \"\$U\" -w \"\$P\" -e \"\$PUBLIC\" -n 1 -m 1 127.0.0.1 2>&1 | tee /tmp/coturn-self.log | grep -E 'channel bind: error|success: 0x' | head -1
if grep -q 'channel bind: error' /tmp/coturn-self.log; then
  echo 'FAIL: self-peer CreatePermission/ChannelBind rejected'
  exit 1
fi
if ! grep -q 'success: 0x' /tmp/coturn-self.log; then
  echo 'FAIL: no success bind for self-peer'
  exit 1
fi
echo \"$REMOTE_PY\" | base64 -d | python3
")

echo "$out"
echo "$out" | grep -q "^PASS:"
echo "OK — coturn video path lock holds"
