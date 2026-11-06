# Development server: where agents build and test. Nothing here serves the public.
# Apply with: SSH_KEY=path/to/key bash deploy/nixos/apply-dev.sh <ip>
{ modulesPath, pkgs, ... }:
{
  imports = [ "${modulesPath}/virtualisation/amazon-image.nix" ];

  system.stateVersion = "26.05";
  networking.hostName = "backroom-dev";
  networking.firewall.allowedTCPPorts = [ 22 ];
  swapDevices = [{ device = "/var/swapfile"; size = 4096; }];

  services.openssh.settings = {
    PasswordAuthentication = false;
    KbdInteractiveAuthentication = false;
  };

  nix.settings = {
    experimental-features = [ "nix-command" "flakes" ];
    auto-optimise-store = true;
  };
  nix.gc = {
    automatic = true;
    dates = "weekly";
    options = "--delete-older-than 14d";
  };

  environment.systemPackages = with pkgs; [ git gh jq nodejs_24 pnpm bun ];
}
