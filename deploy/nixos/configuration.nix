# The existing public host is managed separately from Backroom source.
# Claude must place its unchanged host module at this external path before applying.
{ ... }: { imports = [ /etc/backroom/public-app.nix ]; }
