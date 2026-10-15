-------
Tailscale console: https://console.tailscale.com/admin/machines

Test from mac: nc -vz 100.65.51.120 5432

ssh root@100.65.51.120 "systemctl restart postgresql"

---------

1. VPS (SSH in with ssh -o ClearAllForwardings=yes vps-db)


curl -fsSL https://tailscale.com/install.sh | sh
tailscale up
tailscale ip -4

tailscale up prints a login URL. Open it in your browser and approve the machine.

tailscale ip -4 prints the VPS's address, a 100.x.y.z. Note it down. ssh root@100.65.51.120

2. Mac

Install the Tailscale app from the Mac App Store. Allow VPN and access
Sign in with the same account.

Check with tailscale ping <vps-100-ip> or ping <vps-100-ip>.
3. Postgres on the VPS
Find the config files with sudo -u postgres psql -c "SHOW config_file;", then:
(/etc/postgresql/18/main/postgresql.conf)
In postgresql.conf, set listen_addresses = 'localhost,100.x.y.z', using your VPS's Tailscale IP.
In pg_hba.conf, add this line. Substitute your database and user, and use scram-sha-256 to match the existing entries: host <db> <user> 100.64.0.0/10 scram-sha-256
Restart with sudo systemctl restart postgresql.
4. Firewall on the VPS
Only if a firewall is on, allow 5432 on the Tailscale interface only: ufw allow in on tailscale0 to any port 5432. Leave 5432 closed on the public interface.

5. App

In src/.env, change DATABASE_URL from localhost:5433 to <vps-100-ip>:5432. Keep the same user, password and database.
Stop autossh and ssh vps-db. They are no longer needed.
If the URL has sslmode=require, keep it. Postgres needs SSL configured for that, and its present setup will tell you.
6. Check
psql "<new DATABASE_URL>" -c "select 1", then run the app or clean-slate.

Two notes:

The pg_hba.conf change and the restart are on your production VPS, so make them deliberately. If other apps use this Postgres, a restart briefly interrupts them.
Keep vps-db in your SSH config. It remains your fallback.