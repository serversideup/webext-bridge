class Endpoint {
    private _name: string;
    constructor(path: string) {
        this._name = path;
    }

    public get name() {
        return this._name;
    }

    public get path() {
        console.warn(`'sender.path' is now deprecated, since it no longer supports iframes. Use 'sender.name' instead`)
        return this._name;
    }
    
    public isInternal(): boolean {
        return this.isInternalImpl(false);
    }
    
    public isReallyInternal(): boolean {
        console.warn(`'sender.isReallyInternal()' is now deprecated, since it no longer supports iframes. Use 'sender.isInternal()' instead`)
        return this.isInternalImpl(true);
    }

    public toString() {
        return this._name;
    }

    private isInternalImpl(strict: boolean): boolean {
        if (!strict && this._name.indexOf('devtools') === 0) {
            return true;
        }
        // 'content-script:frame#2' || 'window@712' => false
        return !(/window|frame/.test(this._name));
    }
}

export { Endpoint };
