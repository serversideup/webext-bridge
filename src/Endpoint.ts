class Endpoint {
    private _path: string;
    constructor(path: string) {
        this._path = path;
    }

    public get path() {
        return this._path;
    }

    public isInternal(): boolean {
        return this.isInternalImpl(false);
    }

    public isReallyInternal(): boolean {
        return this.isInternalImpl(true);
    }

    public toString() {
        return this._path;
    }

    private isInternalImpl(strict: boolean): boolean {
        if (!strict && this._path.indexOf('devtools') === 0) {
            return true;
        }
        // 'content-script:frame#2' || 'window@712' => false
        return !(/window|frame/.test(this._path));
    }
}

export { Endpoint };
