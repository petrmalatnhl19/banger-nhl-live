#!/usr/bin/env bash
set -euo pipefail

# Use only on a disposable CI VM. The veth pair has no bridge, route or uplink.
sudo -n ip netns add cal15-a
a_ready=true
b_ready=false
trap 'if "$b_ready"; then sudo -n ip netns del cal15-b; fi; if "$a_ready"; then sudo -n ip netns del cal15-a; fi' EXIT
sudo -n ip netns add cal15-b
b_ready=true
sudo -n ip link add cal15-link-a netns cal15-a type veth peer name cal15-link-b netns cal15-b
sudo -n ip -n cal15-a address add 192.168.244.1/30 dev cal15-link-a
sudo -n ip -n cal15-b address add 192.168.244.2/30 dev cal15-link-b
sudo -n ip -n cal15-a link set cal15-link-a up
sudo -n ip -n cal15-b link set cal15-link-b up

CAL15_NETWORK_SCOPE=namespaces node --experimental-sqlite --test scripts/test_core43_cal15_network.cjs
