# Kubernetes deployment

This directory deploys Nodi from the GitHub Container Registry image:

- `ghcr.io/twarga/nodi:latest`

It assumes a single-node or small homelab-style cluster where Nodi stores files on one persistent volume and is exposed through an ingress controller.

## 1. Create the secret

Create a bcrypt password hash first:

```bash
htpasswd -bnBC 10 "" "your-long-admin-password" | tr -d ':\n'
```

Create the secret imperatively:

```bash
kubectl -n nodi create secret generic nodi-secrets \
  --from-literal=QL_USER=admin \
  --from-literal=QL_PASS_HASH='$2y$10$replace-me-with-your-bcrypt-hash' \
  --from-literal=QL_COOKIE_SECRET='replace-with-at-least-32-random-bytes'
```

Or copy `secret.example.yaml`, fill in the values, and apply it:

```bash
cp deploy/kubernetes/secret.example.yaml deploy/kubernetes/secret.yaml
# edit deploy/kubernetes/secret.yaml with real values
kubectl apply -f deploy/kubernetes/secret.yaml
```

## 2. Apply the manifests

```bash
kubectl apply -k deploy/kubernetes
```

## 3. Adjust before production use

- Replace the PVC size/class to match your cluster.
- Replace the ingress host `nodi.local`.
- Add TLS on the ingress before exposing Nodi beyond a trusted LAN.
- Keep the storage volume on real disk. Do not move uploads to `emptyDir` or memory-backed tmpfs.
- Keep the proxy body size unlimited or deliberately large enough for your expected uploads.
