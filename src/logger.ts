/**
 * Logger class for verbose and standard logging.
 * Methods mirror the console API.
 */
export class Logger {
    public readonly verbose: boolean;

    constructor(verbose?: boolean) {
        this.verbose = verbose ?? false;
    }

    log(...args: any[]) {
        if (this.verbose) {
            // eslint-disable-next-line no-console
            console.log(...args);
        }
    }

    error(...args: any[]) {
        if (this.verbose) {
            // eslint-disable-next-line no-console
            console.error(...args);
        }
    }

    warn(...args: any[]) {
        if (this.verbose) {
            // eslint-disable-next-line no-console
            console.warn(...args);
        }
    }

    info(...args: any[]) {
        if (this.verbose) {
            // eslint-disable-next-line no-console
            console.info(...args);
        }
    }
}
