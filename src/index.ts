import fs from "fs";
import valids from "vlds";
import { createHash } from "crypto";
import match from "./match";

declare namespace Database {
    export interface Document<T = any> {
        readonly id: string;
        data: T;
    }

    export interface Options extends Partial<{
        path: string;
        reviver: (this: any, key: string, value: any) => any;
        replacer?: (this: any, key: string, value: any) => any;
    }> { }

    export interface Collection<T = any> {
        [id: string]: Database.Document<T>;
    }
}

// Check whether the function is a type created by vlds
function isType(f: any): f is valids.Type {
    return f.toString().startsWith("class");
}

class Database {
    private readonly data: {
        [collectionName: string]: Database.Collection;
    };
    private readonly path: string;
    private readonly replacer: Database.Options["replacer"];

    constructor(opts?: Database.Options) {
        opts ||= {};

        const { path, reviver } = opts;

        // Parse data
        if (path && !fs.existsSync(path))
            fs.appendFileSync(path, "{}");

        this.data = path ? JSON.parse(fs.readFileSync(path).toString() ?? "{}", reviver) : {};

        // Set properties
        delete opts.reviver;
        Object.assign(this, opts);
    }

    private async syncFile() {
        if (this.path)
            await fs.promises.writeFile(this.path, JSON.stringify(this.data, this.replacer));
    }

    collect<T = any>(name: string, validator: valids.Validator | valids.Type) {
        const type = isType(validator)
            ? validator
            : valids.type(validator);

        const pointer = this;

        if (!pointer.data[name])
            pointer.data[name] = {} as Database.Collection<T>;

        function hash(d: string) {
            return createHash("sha384").update(d).digest("hex");
        }

        const Collection = class {
            readonly value: T;
            readonly id: string;

            constructor(data: T) {
                this.value = new type(data);
                this.id = hash(String(Date.now()) + JSON.stringify(pointer.data[name]) + name);
            }

            async save() {
                pointer.data[name][this.id] = {
                    id: this.id,
                    data: this.value
                }

                await pointer.syncFile();

                return this.value;
            }

            async del() {
                const res = delete pointer.data[name][this.id];

                if (res)
                    await pointer.syncFile();

                return res;
            }

            async setValue(value: T) {
                // @ts-ignore
                this.value = new type(value);
                await this.save();
            }

            static async remove(id: string) {
                const res = delete pointer.data[name][id];

                if (res)
                    await pointer.syncFile();

                return res;
            }

            static async removeAll(o: any, count?: number) {
                let res: boolean = true;

                for (const key in pointer.data[name]) {
                    if (typeof count === "number" && count <= 0)
                        break;

                    // Try delete the object if matches
                    if (match(o, pointer.data[name][key]) && !delete pointer.data[name][key]) {
                        res = false;
                        break;
                    }
                }

                await pointer.syncFile();

                return res;
            }

            static select(id: string): Database.Document<T> {
                return pointer.data[name][id];
            }

            static find(o: any, count?: number): Database.Document<T>[] {
                const vals = [];

                for (const key in pointer.data[name]) {
                    if (typeof count === "number" && count <= 0)
                        break;

                    const doc = pointer.data[name][key];

                    // Add to value list
                    if (match(o, doc.data)) {
                        vals.push(doc);
                        if (typeof count === "number")
                            count--;
                    }
                }

                return vals;
            }

            static findOne(o: any) {
                return this.find(o, 1)[0];
            }

            static async update(o: any, value: T, rewrite?: boolean) {
                const doc = this.findOne(o);

                if (!rewrite && typeof pointer.data[name][doc.id].data === "object")
                    Object.assign(pointer.data[name][doc.id].data, value);
                else
                    pointer.data[name][doc.id].data = value;

                // Check type
                pointer.data[name][doc.id].data = new type(pointer.data[name][doc.id].data);

                await pointer.syncFile();
            }

            static async updateID(id: string, value: T, rewrite?: boolean) {
                if (!rewrite && typeof pointer.data[name][id].data === "object")
                    Object.assign(pointer.data[name][id].data, value);
                else
                    pointer.data[name][id].data = value;

                // Check type
                pointer.data[name][id].data = new type(pointer.data[name][id].data);

                await pointer.syncFile();
            }

            static async clear() {
                pointer.data[name] = {};

                await pointer.syncFile();
            }
        }

        return Collection;
    }

    async remove(collectionName: string) {
        delete this.data[collectionName];

        await this.syncFile();
    }

    async clear() {
        // @ts-ignore
        this.data = {};

        await this.syncFile();
    }
}

export = Database;