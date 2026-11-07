# Studio host. Apply only after reviewing docs/STUDIO-SERVER.md.
{ modulesPath, pkgs, lib, ... }:
let
  tools = with pkgs; [ git gh jq nodejs_24 pnpm bun sops curl openssh util-linux
    bash coreutils gnugrep gnused gawk findutils
    iptables postgresql chromium (python3.withPackages (p: [ p.requests p.pyyaml ])) ];
  servicePath = lib.makeBinPath tools + ":/opt/backroom/tools/bin";
  compose = "${pkgs.docker}/bin/docker compose -p backroom-block0 --env-file /etc/backroom/switch.env -f /etc/backroom/switch-compose.yml --profile gateway";
  controller = name: after: {
    description = "Backroom ${name} controller";
    wantedBy = [ "multi-user.target" ];
    after = after;
    wants = [ "backroom-switch.service" ] ++ after;
    unitConfig.ConditionPathExists = [ "/var/lib/backroom-agent/${name}/controller.db" "/srv/backroom/.switch-runtime/studio-move-ready" "!/var/lib/backroom/sync-incomplete" ];
    environment = {
      PATH = lib.mkForce servicePath; HOME = "/var/lib/backroom-agent";
      BROWSER_PATH = "${pkgs.chromium}/bin/chromium";
      # review-env detects Docker by PATH. This wrapper forces its local backend.
      BACKROOM_REVIEW_BACKEND = "local";
      GIT_NO_REPLACE_OBJECTS = "1";
      GIT_AUTHOR_NAME = "Backroom Builder";
      GIT_AUTHOR_EMAIL = "builder@backroom.invalid";
      GIT_COMMITTER_NAME = "Backroom Builder";
      GIT_COMMITTER_EMAIL = "builder@backroom.invalid";
    };
    serviceConfig = {
      User = "agent"; Group = "backroom"; UMask = "0007";
      WorkingDirectory = "/srv/backroom";
      ExecStart = "${pkgs.nodejs_24}/bin/node /opt/backroom/controller/cli.mjs run --data-dir /var/lib/backroom-agent/${name}";
      Restart = "always"; RestartSec = 5; KillMode = "control-group";
      NoNewPrivileges = true; PrivateDevices = true; ProtectSystem = "strict";
      ReadWritePaths = [ "/var/lib/backroom-agent" "/srv/backroom/workspaces" "/tmp" ];
      InaccessiblePaths = [ "/srv/backroom/.secrets" "/srv/backroom/.switch-runtime" "/root" "/home/studio" "/run/docker.sock" ];
      ProtectKernelTunables = true; ProtectKernelModules = true; ProtectControlGroups = true;
      RestrictSUIDSGID = true;
      # Provider diagnostics may contain credentials. Only our status checks log.
      StandardOutput = "null"; StandardError = "null";
    };
  };
in {
  imports = [ "${modulesPath}/virtualisation/amazon-image.nix" ];
  system.stateVersion = "26.05";
  networking.hostName = "backroom-dev";
  networking.firewall.allowedTCPPorts = [ 22 ];
  swapDevices = [{ device = "/var/swapfile"; size = 4096; }];
  services.openssh.settings = {
    PasswordAuthentication = false; KbdInteractiveAuthentication = false;
  };
  nix.settings = {
    experimental-features = [ "nix-command" "flakes" ]; auto-optimise-store = true;
  };
  nix.gc = { automatic = true; dates = "weekly"; options = "--delete-older-than 14d"; };
  programs.nix-ld.enable = true;
  programs.git.enable = true;
  virtualisation.docker.enable = true; # Switch only; neither studio nor agent joins docker.
  environment.systemPackages = tools;
  environment.extraInit = ''
    export PATH="/opt/backroom/tools/bin:$PATH"
    if [ "$(id -un)" = agent ]; then
      export BACKROOM_REVIEW_BACKEND=local
      export GIT_NO_REPLACE_OBJECTS=1
      export BROWSER_PATH=${pkgs.chromium}/bin/chromium
    fi
  '';
  users.groups.backroom = {};
  users.users.studio = {
    isSystemUser = true; group = "backroom"; home = "/home/studio";
    createHome = true; homeMode = "0700"; shell = pkgs.bashInteractive;
  };
  users.users.agent = {
    isSystemUser = true; group = "backroom"; home = "/var/lib/backroom-agent";
    createHome = true; homeMode = "0700"; shell = pkgs.bashInteractive;
  };
  systemd.tmpfiles.rules = [
    "d /srv/backroom 0750 root backroom -"
    "d /srv/backroom/.secrets 0700 studio backroom -"
    "d /srv/backroom/.switch-runtime 0700 studio backroom -"
    "d /srv/backroom/workspaces 2770 studio backroom -"
    "d /srv/backroom/.handoff-contracts 0750 studio backroom -"
    "d /var/lib/backroom-agent 0700 agent backroom -"
    "d /var/lib/backroom-agent/.codex 0700 agent backroom -"
    "d /var/lib/backroom-agent/lead 0700 agent backroom -"
    "d /var/lib/backroom-agent/build 0700 agent backroom -"
    "d /opt/backroom 0755 root root -"
    "d /etc/backroom 0700 root root -"
    "d /var/lib/backroom 0700 root root -"
    "d /home/studio/.backroom-git 0700 studio backroom -"
  ];
  # Agent Git is unprivileged; desk always uses its protected shadow.
  # Wildcard is limited to the shared workspace tree, not all Git directories.
  programs.git.config.safe.directory = [ "/srv/backroom" "/srv/backroom/workspaces/*" ];
  # Metadata credentials stay with root. UID rules cover interactive sessions too.
  networking.firewall.extraCommands = ''
    iptables -I OUTPUT 1 -m owner --uid-owner agent -d 169.254.169.254 -j REJECT
    ip6tables -I OUTPUT 1 -m owner --uid-owner agent -d fd00:ec2::254 -j REJECT
    iptables -I OUTPUT 1 -m owner --uid-owner studio -d 169.254.169.254 -j REJECT
    ip6tables -I OUTPUT 1 -m owner --uid-owner studio -d fd00:ec2::254 -j REJECT
    iptables -I OUTPUT 1 -m owner --uid-owner agent -p tcp --dport 5432 -j REJECT
    ip6tables -I OUTPUT 1 -m owner --uid-owner agent -p tcp --dport 5432 -j REJECT
  '';
  networking.firewall.extraStopCommands = ''
    iptables -D OUTPUT -m owner --uid-owner agent -d 169.254.169.254 -j REJECT || true
    ip6tables -D OUTPUT -m owner --uid-owner agent -d fd00:ec2::254 -j REJECT || true
    iptables -D OUTPUT -m owner --uid-owner studio -d 169.254.169.254 -j REJECT || true
    ip6tables -D OUTPUT -m owner --uid-owner studio -d fd00:ec2::254 -j REJECT || true
    iptables -D OUTPUT -m owner --uid-owner agent -p tcp --dport 5432 -j REJECT || true
    ip6tables -D OUTPUT -m owner --uid-owner agent -p tcp --dport 5432 -j REJECT || true
  '';
  systemd.services.backroom-switch = {
    description = "Backroom Switch only (Docker Compose)";
    wantedBy = [ "multi-user.target" ];
    after = [ "network-online.target" "docker.service" ];
    wants = [ "network-online.target" "docker.service" ];
    unitConfig.ConditionPathExists = "/srv/backroom/.switch-runtime/studio-move-ready";
    path = [ pkgs.docker pkgs.curl pkgs.coreutils ];
    environment = { SWITCH_BIND_ADDR = "127.0.0.1"; POSTGRES_HOST_PORT = "5432"; API_HOST_PORT = "8000"; GATEWAY_HOST_PORT = "3000"; };
    serviceConfig = {
      WorkingDirectory = "/etc/backroom";
      ExecStartPre = "${compose} up -d --wait --wait-timeout 180";
      ExecStart = "${pkgs.bash}/bin/bash /etc/backroom/studio-switch-watch.sh";
      ExecStop = "${compose} stop";
      Restart = "always"; RestartSec = 5; TimeoutStartSec = 240; TimeoutStopSec = 120;
      StandardOutput = "null"; StandardError = "null";
    };
  };
  systemd.services.backroom-controller-lead = controller "lead" [ "backroom-switch.service" ];
  systemd.services.backroom-controller-build = controller "build" [ "backroom-controller-lead.service" ];
  systemd.services.backroom-studio = {
    description = "Backroom door and per-project desks";
    wantedBy = [ "multi-user.target" ];
    after = [ "backroom-controller-lead.service" "backroom-controller-build.service" "backroom-identity.service" "backroom-provision.service" ];
    wants = [ "backroom-controller-lead.service" "backroom-controller-build.service" "backroom-identity.service" "backroom-provision.service" ];
    unitConfig.ConditionPathExists = [ "/srv/backroom/.switch-runtime/studio-move-ready" "!/var/lib/backroom/sync-incomplete" ];
    environment = { PATH = lib.mkForce ("/opt/backroom/studio-bin:" + servicePath); HOME = "/home/studio"; BACKROOM_SUPERVISED = "1"; };
    serviceConfig = {
      User = "studio"; Group = "backroom"; UMask = "0007";
      WorkingDirectory = "/srv/backroom";
      ExecStart = "${pkgs.bash}/bin/bash /srv/backroom/scripts/studio-supervise.sh";
      Restart = "always"; RestartSec = 5; KillMode = "control-group";
      NoNewPrivileges = true; PrivateDevices = true;
      StandardOutput = "journal"; StandardError = "journal";
    };
  };
  systemd.services.backroom-identity = {
    unitConfig.ConditionPathExists = "!/var/lib/backroom/sync-incomplete";
    description = "Backroom Switch identity lookup socket";
    wantedBy = [ "multi-user.target" ];
    after = [ "docker.service" "backroom-switch.service" ];
    requires = [ "docker.service" ];
    path = [ pkgs.docker pkgs.coreutils pkgs.python3 ];
    environment = {
      BACKROOM_IDENTITY_SOCKET = "/run/backroom-identity.sock";
      BACKROOM_IDENTITY_GROUP = "backroom";
    };
    serviceConfig = {
      Type = "simple";
      User = "root";
      Group = "backroom";
      UMask = "0007";
      ExecStart = "${pkgs.python3}/bin/python3 -I /srv/backroom/scripts/identity-helper.py";
      Restart = "on-failure";
      RestartSec = 2;
      NoNewPrivileges = true;
      PrivateTmp = true;
      PrivateDevices = true;
      ProtectSystem = "strict";
      ProtectHome = true;
      ReadWritePaths = [ "/run" ];
      RestrictSUIDSGID = true;
      ProtectKernelTunables = true;
      ProtectKernelModules = true;
      ProtectControlGroups = true;
      StandardOutput = "journal";
      StandardError = "journal";
    };
  };
  systemd.services.backroom-provision = {
    unitConfig.ConditionPathExists = "!/var/lib/backroom/sync-incomplete";
    description = "Backroom fixed builder provisioning socket";
    wantedBy = [ "multi-user.target" ];
    before = [ "backroom-studio.service" ];
    path = tools;
    serviceConfig = {
      Type = "simple";
      User = "root";
      Group = "backroom";
      UMask = "0077";
      ExecStart = "${pkgs.python3}/bin/python3 -I /srv/backroom/scripts/provision-helper.py";
      Restart = "on-failure";
      RestartSec = 2;
      KillMode = "control-group";
      NoNewPrivileges = true;
      PrivateTmp = true;
      PrivateDevices = true;
      ProtectSystem = "strict";
      ProtectHome = true;
      ReadWritePaths = [ "/run" "/srv/backroom/workspaces" "/var/lib/backroom-agent/.codex" ];
      InaccessiblePaths = [ "/srv/backroom/.secrets" "/srv/backroom/.switch-runtime" "/root" "/home/studio" "/run/docker.sock" ];
      CapabilityBoundingSet = [ "CAP_CHOWN" "CAP_FOWNER" "CAP_DAC_OVERRIDE" "CAP_SETUID" "CAP_SETGID" "CAP_KILL" ];
      RestrictAddressFamilies = [ "AF_UNIX" "AF_INET" "AF_INET6" "AF_NETLINK" ];
      ProtectKernelTunables = true;
      ProtectKernelModules = true;
      ProtectControlGroups = true;
      RestrictSUIDSGID = true;
      LockPersonality = true;
      StandardOutput = "journal";
      StandardError = "journal";
    };
  };
}
