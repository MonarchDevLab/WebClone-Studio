import { CapturedApiEndpoint } from '../cloner/reverse-engineering/api-interceptor';

export interface OpenApiSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  paths: Record<string, Record<string, any>>;
}

export class ApiContractGenerator {
  /**
   * Yakalanan API uç noktalarını OpenAPI 3.1 JSON spesifikasyonuna dönüştürür.
   */
  public static generateOpenApiSpec(endpoints: CapturedApiEndpoint[], targetHost?: string): OpenApiSpec {
    const spec: OpenApiSpec = {
      openapi: '3.1.0',
      info: {
        title: targetHost ? `${targetHost} API Sözleşmesi` : 'WebClone Extracted API Specification',
        version: '1.0.0',
        description: 'WebClone Studio otonom ağ dinleyicisi tarafından tersine mühendislikle yakalanmış ve derlenmiş API uç noktaları.',
      },
      paths: {},
    };

    for (const ep of endpoints) {
      let pathName = ep.pathname || '/';
      if (!pathName.startsWith('/')) pathName = `/${pathName}`;
      pathName = pathName.replace(/\/+$/, '') || '/';

      if (!spec.paths[pathName]) {
        spec.paths[pathName] = {};
      }

      const method = (ep.method || 'GET').toLowerCase();
      const params: any[] = [];

      try {
        const parsedUrl = new URL(ep.url);
        parsedUrl.searchParams.forEach((val, key) => {
          params.push({
            name: key,
            in: 'query',
            required: false,
            schema: {
              type: isNaN(Number(val)) ? 'string' : 'number',
              example: val,
            },
          });
        });
      } catch {}

      const responseSchema = this.inferJsonSchema(ep.responseData);

      spec.paths[pathName][method] = {
        summary: `${ep.method.toUpperCase()} ${pathName}`,
        description: `Tersine mühendislik ile yakalanan ${ep.status || 200} durum kodlu uç nokta.`,
        parameters: params.length > 0 ? params : undefined,
        responses: {
          [String(ep.status || 200)]: {
            description: 'Otomatik yakalanan başarılı yanıt gövdesi',
            content: {
              [ep.contentType || 'application/json']: {
                schema: responseSchema,
              },
            },
          },
        },
      };
    }

    return spec;
  }

  /**
   * Yakalanan API uç noktalarından TypeScript Interface ve Tipleri üretir.
   */
  public static generateTypeScriptDefinitions(endpoints: CapturedApiEndpoint[]): string {
    let output = '/**\n * WebClone Studio - Otomatik Üretilmiş API TypeScript Tanımları\n * Yakalanan XHR/Fetch/JSON yanıt modelleri\n */\n\n';
    const seenNames = new Set<string>();

    for (const ep of endpoints) {
      const typeName = this.formatTypeName(ep.method, ep.pathname);
      if (seenNames.has(typeName)) continue;
      seenNames.add(typeName);

      output += `/**\n * Endpoint: ${ep.method.toUpperCase()} ${ep.pathname}\n * Status: ${ep.status || 200}\n */\n`;
      const schema = this.inferJsonSchema(ep.responseData);
      output += this.schemaToTypeScript(typeName, schema);
    }

    return output;
  }

  private static formatTypeName(method: string, pathname: string): string {
    const cleanPath = pathname
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .trim()
      .split(/\s+/)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('');
    const m = method.charAt(0).toUpperCase() + method.slice(1).toLowerCase();
    return `${m}${cleanPath || 'Root'}Response`;
  }

  private static inferJsonSchema(data: any): any {
    if (data === null || data === undefined) {
      return { type: 'null' };
    }
    if (Array.isArray(data)) {
      return {
        type: 'array',
        items: data.length > 0 ? this.inferJsonSchema(data[0]) : { type: 'object' },
      };
    }
    const type = typeof data;
    if (type === 'string') return { type: 'string', example: data.slice(0, 50) };
    if (type === 'number') return { type: 'number', example: data };
    if (type === 'boolean') return { type: 'boolean', example: data };
    if (type === 'object') {
      const properties: Record<string, any> = {};
      for (const [key, val] of Object.entries(data)) {
        properties[key] = this.inferJsonSchema(val);
      }
      return {
        type: 'object',
        properties,
      };
    }
    return { type: 'string' };
  }

  private static schemaToTypeScript(name: string, schema: any): string {
    if (schema.type === 'object' && schema.properties) {
      let res = `export interface ${name} {\n`;
      for (const [key, prop] of Object.entries<any>(schema.properties)) {
        const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
        res += `  ${safeKey}?: ${this.schemaTypeToTs(prop)};\n`;
      }
      res += `}\n\n`;
      return res;
    }

    if (schema.type === 'array') {
      const itemType = this.schemaTypeToTs(schema.items);
      return `export type ${name} = ${itemType}[];\n\n`;
    }

    return `export type ${name} = ${this.schemaTypeToTs(schema)};\n\n`;
  }

  private static schemaTypeToTs(schema: any): string {
    if (!schema) return 'any';
    if (schema.type === 'array') {
      return `${this.schemaTypeToTs(schema.items)}[]`;
    }
    if (schema.type === 'object') {
      if (!schema.properties || Object.keys(schema.properties).length === 0) {
        return 'Record<string, any>';
      }
      const props = Object.entries<any>(schema.properties)
        .slice(0, 30) // taşmayı önlemek için sınır
        .map(([k, v]) => {
          const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
          return `${safeKey}?: ${this.schemaTypeToTs(v)}`;
        })
        .join('; ');
      return `{ ${props} }`;
    }
    if (schema.type === 'string') return 'string';
    if (schema.type === 'number') return 'number';
    if (schema.type === 'boolean') return 'boolean';
    if (schema.type === 'null') return 'null | any';
    return 'any';
  }
}
