$body = @{
  x = 175.0
  y = -42.0
  z = -95.0
  yaw = 135.0
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://127.0.0.1:8787/position" -Method Post -Body $body -ContentType "application/json"
