#!/usr/bin/env python3
# TURN allocation smoke test (used by scripts/deploy.sh).
# Reads ice_servers from the public /config.json, then does a real STUN/TURN
# Allocate (long-term credentials) on every turn:/turns: URL and prints
# PASS relay=ip:port or FAIL per URL. Exit 1 when any URL fails.
# Usage: scripts/deploy/turn-alloc-test.py [https://ruletka.vip/config.json]
import hashlib,hmac,os,socket,ssl,struct,sys,json,urllib.request
cfg=json.load(urllib.request.urlopen(sys.argv[1] if len(sys.argv)>1 else "https://ruletka.vip/config.json",timeout=10))
def attr(t,v): return struct.pack("!HH",t,len(v))+v+b"\0"*((4-len(v)%4)%4)
def parse(m):
    t,l=struct.unpack("!HH",m[:4]);b=m[20:20+l];a={};i=0
    while i+4<=len(b):
        at,al=struct.unpack("!HH",b[i:i+4]);i+=4;a[at]=b[i:i+al];i+=al+((4-al%4)%4)
    return t,a
def msg(t,attrs,key=None):
    tid=os.urandom(12);body=b"".join(attrs)
    if key:
        hdr=struct.pack("!HHI",t,len(body)+24,0x2112A442)+tid
        mi=hmac.new(key,hdr+body,hashlib.sha1).digest();body+=attr(0x0008,mi)
    return struct.pack("!HHI",t,len(body),0x2112A442)+tid+body
def xaddr(v):
    port=struct.unpack("!H",v[2:4])[0]^0x2112;ip=struct.unpack("!I",v[4:8])[0]^0x2112A442
    return socket.inet_ntoa(struct.pack("!I",ip)),port
class Conn:
    def __init__(s,proto,host,port):
        s.proto=proto
        if proto=="udp":
            s.s=socket.socket(socket.AF_INET,socket.SOCK_DGRAM);s.s.settimeout(4);s.addr=(host,port)
        else:
            raw=socket.create_connection((host,port),timeout=6)
            if proto=="tls":
                ctx=ssl.create_default_context();raw=ctx.wrap_socket(raw,server_hostname=host)
            s.s=raw;s.s.settimeout(6)
    def rt(s,m):
        if s.proto=="udp":
            s.s.sendto(m,s.addr);return s.s.recv(4096)
        s.s.sendall(m);h=b""
        while len(h)<20:
            d=s.s.recv(20-len(h))
            if not d: raise EOFError("closed by server")
            h+=d
        l=struct.unpack("!H",h[2:4])[0];b=b""
        while len(b)<l:
            d=s.s.recv(l-len(b))
            if not d: raise EOFError("closed")
            b+=d
        return h+b
def test(url,user,cred):
    u=url.split(":",1);scheme=u[0];rest=u[1];hp=rest.split("?")[0];q=rest.split("?")[1] if "?" in rest else ""
    host,port=hp.rsplit(":",1);port=int(port)
    proto="tls" if scheme=="turns" else ("tcp" if "transport=tcp" in q else "udp")
    try:
        c=Conn(proto,host,port)
        req=[attr(0x0019,bytes([17,0,0,0]))]
        t,a=parse(c.rt(msg(0x0003,req)))
        realm=a[0x0014];nonce=a[0x0015]
        key=hashlib.md5(user.encode()+b":"+realm+b":"+cred.encode()).digest()
        t,a=parse(c.rt(msg(0x0003,req+[attr(0x0006,user.encode()),attr(0x0014,realm),attr(0x0015,nonce)],key)))
        if t==0x0103: return "PASS relay=%s:%d"%xaddr(a[0x0016])
        return "FAIL type=%x err=%r"%(t,a.get(0x0009))
    except Exception as e: return "FAIL %s: %s"%(type(e).__name__,e)
bad=0
for s in cfg["ice_servers"]:
    for url in (s["urls"] if isinstance(s["urls"],list) else [s["urls"]]):
        if url.startswith("turn"):
            r=test(url,s['username'],s['credential']); bad+=r.startswith("FAIL")
            print(f"{url:45s} {r}")
sys.exit(1 if bad else 0)
