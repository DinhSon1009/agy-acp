export declare const DEFAULT_AGY_RELEASES_API = "https://api.github.com/repos/google-antigravity/antigravity-cli/releases/latest";
export interface EnsureAgyOptions {
    env?: NodeJS.ProcessEnv;
    installBinDir?: string;
    releasesApiUrl?: string;
    log?: (message: string) => void;
    warn?: (message: string) => void;
    fetchImpl?: typeof fetch;
}
export declare function defaultInstallBinDir(env?: NodeJS.ProcessEnv): string | undefined;
export declare function installedAgyPath(installBinDir: string): string;
/** Map this process to a GitHub release asset file name. */
export declare function releaseAssetName(platform?: NodeJS.Platform, arch?: NodeJS.Architecture): string;
/** Return true when `agyPath` points at an executable file. */
export declare function isExecutableFile(filePath: string): boolean;
/** Prepend a directory to `PATH` so bare `agy` resolves there. */
export declare function prependPathDir(env: NodeJS.ProcessEnv, dir: string): void;
/** Resolve the first usable agy executable from the install dir or PATH. */
export declare function resolveAgyExecutable(options?: EnsureAgyOptions): Promise<string | null>;
/**
 * Install agy from GitHub Releases when no executable is available on PATH.
 * Returns the installed absolute path, an existing path, or null on failure.
 */
export declare function ensureAgyInstalled(options?: EnsureAgyOptions): Promise<string | null>;
