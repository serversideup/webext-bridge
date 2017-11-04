declare class Endpoint {
    private _path;
    constructor(path: string);
    readonly path: string;
    isInternal(): boolean;
    isReallyInternal(): boolean;
    toString(): string;
    private isInternalImpl(strict);
}
export { Endpoint };
