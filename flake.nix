{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    bun2nix.url = "github:baileyluTCD/bun2nix";
  };

  outputs = { self, nixpkgs, bun2nix }: 
  let
    system = "x86_64-linux";
    pkgs = import nixpkgs {
      inherit system;
      overlays = [ bun2nix.overlays.default ];
    };
    commonNativeBuildInputs = with pkgs; [
      bun
      zsh
      pkg-config
      wrapGAppsHook4
      cargo
      cargo-tauri
      nodejs
      rustc
      typescript-language-server
    ];

    commonBuildInputs = with pkgs; [
      librsvg
      webkitgtk_4_1
      xdotool
      libsoup_3
      gtk3
      glib
      openssl
      gsettings-desktop-schemas
    ];

    bun2nixPkgs = bun2nix.packages.${system};
  in {
    packages.${system}.default = pkgs.stdenv.mkDerivation {
      pname = "dashboard";
      version = "1.1.1";
      src = pkgs.lib.cleanSource ./.;

      nativeBuildInputs = commonNativeBuildInputs ++ [
        pkgs.bun2nix.hook
	pkgs.rustPlatform.cargoSetupHook
      ];

      buildInputs = commonBuildInputs;

      bunDeps = pkgs.bun2nix.fetchBunDeps {
        bunNix = ./bun.nix;
      };

      cargoDeps = pkgs.rustPlatform.importCargoLock {
        lockFile = ./src-tauri/Cargo.lock;
      };
      cargoRoot = "src-tauri";

      buildPhase = ''
        runHook preBuild
        export HOME=$TMPDIR
        bun run tauri build --no-bundle
        runHook postBuild
      '';

      installPhase = ''
        runHook preInstall
        mkdir -p $out/bin
        cp src-tauri/target/release/dashboard $out/bin/dashboard
        runHook postInstall
      '';

      meta = { mainProgram = "dashboard"; };
    };

    devShells.${system}.default = pkgs.mkShell {
      nativeBuildInputs = commonNativeBuildInputs;

      buildInputs = commonBuildInputs;

      packages = with pkgs; [
        xdg-utils
        bun2nixPkgs
      ];

      shellHook = ''
        export XDG_DATA_DIRS="$GSETTINGS_SCHEMAS_PATH"
        unset NIX_ENFORCE_PURITY
        unset NIX_HARDENING_ENABLE

	      exec zsh
      '';

      NIX_ENFORCE_PURITY = 0;

      hardeningDisable = [ "all" ];

    };
  };
}
