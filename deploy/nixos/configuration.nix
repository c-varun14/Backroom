# Public demo host: fictional bakery plus the proof page. No secrets, AI logins
# or Switch server live here. Apply with: bash deploy/nixos/deploy.sh <ssh-host>
{ modulesPath, pkgs, lib, ... }:
let
  hostName = lib.strings.trim (builtins.readFile ./public-host.txt);
  bakery = ../../rehearsal/bakery;
  proof = pkgs.runCommand "backroom-proof" { } ''
    mkdir -p $out/proof
    cp ${../../docs/index.html} $out/proof/index.html
  '';
in
{
  imports = [ "${modulesPath}/virtualisation/amazon-image.nix" ];

  system.stateVersion = "26.05";
  networking.hostName = "backroom-demo";
  networking.firewall.allowedTCPPorts = [ 22 80 443 ];
  swapDevices = [{ device = "/var/swapfile"; size = 2048; }];

  services.openssh.settings = {
    PasswordAuthentication = false;
    KbdInteractiveAuthentication = false;
  };

  # Runs as a throwaway user with no write access outside its own state folder.
  systemd.services.morrowcrumb = {
    description = "Morrowcrumb Bakery fictional demo";
    wantedBy = [ "multi-user.target" ];
    after = [ "network.target" ];
    environment = {
      BIND_HOST = "127.0.0.1";
      PUBLIC_ORIGIN = "https://${hostName}";
      PORT = "3210";
      DATABASE_PATH = "/var/lib/morrowcrumb/orders.sqlite";
      OWNER_PASSWORD_FILE = "/var/lib/morrowcrumb/owner-password";
    };
    # A random owner password is made on first start and never printed.
    preStart = ''
      test -s "$OWNER_PASSWORD_FILE" || ${pkgs.openssl}/bin/openssl rand -hex 24 > "$OWNER_PASSWORD_FILE"
    '';
    serviceConfig = {
      ExecStart = "${pkgs.bun}/bin/bun run ${bakery}/server.ts";
      WorkingDirectory = "${bakery}";
      DynamicUser = true;
      StateDirectory = "morrowcrumb";
      Restart = "always";
      MemoryMax = "512M";
      NoNewPrivileges = true;
      PrivateTmp = true;
      PrivateDevices = true;
      ProtectHome = true;
      ProtectSystem = "strict";
      RestrictAddressFamilies = [ "AF_INET" "AF_INET6" "AF_UNIX" ];
    };
  };

  # Sample orders are cleared every night so the demo always has open slots.
  systemd.services.morrowcrumb-reset = {
    description = "Reset fictional bakery orders";
    serviceConfig.Type = "oneshot";
    script = ''
      ${pkgs.systemd}/bin/systemctl stop morrowcrumb
      rm -f /var/lib/private/morrowcrumb/orders.sqlite*
      ${pkgs.systemd}/bin/systemctl start morrowcrumb
    '';
  };
  systemd.timers.morrowcrumb-reset = {
    wantedBy = [ "timers.target" ];
    timerConfig.OnCalendar = "*-*-* 21:00:00 UTC";
  };

  services.caddy = {
    enable = true;
    virtualHosts.${hostName}.extraConfig = ''
      encode gzip
      redir /proof /proof/
      handle /proof/* {
        root * ${proof}
        file_server
      }
      handle {
        reverse_proxy 127.0.0.1:3210
      }
    '';
  };
}
