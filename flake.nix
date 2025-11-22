{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
  };
  
  outputs = { nixpkgs, ... }:
    let
      forAllSystems = function:
        nixpkgs.lib.genAttrs nixpkgs.lib.systems.flakeExposed
          (system:
            let
              pkgs = import nixpkgs {
                inherit system;
                overlays = [
                  (final: prev: {
                    doppler = prev.stdenv.mkDerivation rec {
                      pname = "doppler";
                      version = "3.75.1";
                      
                      src = prev.fetchurl {
                        url = "https://github.com/DopplerHQ/cli/releases/download/${version}/doppler_${version}_linux_amd64.tar.gz";
                        sha256 = "sha256-C4WCMtqpo/0G0cPxuaNwxoz+P5aA7Bpg1UAZnNhZvqA=";
                      };
                      
                      sourceRoot = ".";
                      
                      installPhase = ''
                        runHook preInstall
                        
                        mkdir -p $out/bin
                        install -m755 doppler $out/bin/doppler
                        
                        runHook postInstall
                      '';
                      
                      meta = with prev.lib; {
                        description = "The official CLI for interacting with your Doppler secrets";
                        homepage = "https://doppler.com";
                        license = licenses.asl20;
                        platforms = [ "x86_64-linux" ];
                      };
                    };
                  })
                ];
              };
            in function pkgs
          );
    in {
      formatter = forAllSystems (pkgs: pkgs.alejandra);
      
      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          packages = with pkgs; [
            flyctl
            corepack
            bun
            doppler
          ];
        };
      });
    };
}
