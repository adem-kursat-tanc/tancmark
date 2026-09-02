import json
import os
import sys


def emit(payload):
    sys.stdout.write(json.dumps(payload, separators=(",", ":")) + "\n")
    sys.stdout.flush()


emit({"requestId": "worker", "status": "READY", "pid": os.getpid()})
for line in sys.stdin:
    request = json.loads(line)
    request_id = request.get("requestId", "")
    operation = request.get("operation", "")
    if operation == "ping":
        emit({"requestId": request_id, "status": "ALIVE", "pid": os.getpid()})
    elif operation == "shutdown":
        emit({"requestId": request_id, "status": "STOPPED", "pid": os.getpid()})
        break
    else:
        os._exit(23)
