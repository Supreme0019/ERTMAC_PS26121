import urllib.request, json

base = "http://localhost:4001/api"

def post(path, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(f"{base}{path}", data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

# Try registering test user
user_data = {
    "name": "Drilling Engineer",
    "email": "engineer@oilindia.in",
    "password": "Password123!",
    "role": "drilling_engineer"
}

token = None
try:
    res = post("/auth/register", user_data)
    token = res["data"]["accessToken"]
    print("Registered successfully, token obtained.")
except Exception as e:
    # Try login
    try:
        res = post("/auth/login", {"email": "engineer@oilindia.in", "password": "Password123!"})
        token = res["data"]["accessToken"]
        print("Logged in successfully, token obtained.")
    except Exception as e2:
        print("Auth error:", e2)

print("Token available:", bool(token))
