{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }: 
  let
    system = "x86_64-linux";
    pkgs = nixpkgs.legacyPackages.${system};
  in {
    devShells.${system}.default = pkgs.mkShell {
      nativeBuildInputs = with pkgs; [
        bun
        zsh
        pkg-config
        wrapGAppsHook4
        cargo
        cargo-tauri
        nodejs
        rustc
      ];

      buildInputs = with pkgs; [
        librsvg
        webkitgtk_4_1
      ];

      shellHook = ''
        export XDG_DATA_DIRS="$GSETTINGS_SCHEMAS_PATH"
        exec zsh
      '';
    };
  };
}
