/**
 * Schema Validation Service
 * Provides JSON Schema validation and type checking for workflow nodes
 */

import Ajv, { JSONSchemaType, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { supabase } from '@/lib/supabase/clientV2';
import logger from '@/lib/utils/logger';

export interface NodeSchema {
  nodeId: string;
  nodeType: string;
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
  version: number;
}

export interface SchemaValidationResult {
  isValid: boolean;
  errors?: Array<{
    path: string;
    message: string;
    keyword: string;
    params: any;
  }>;
  warnings?: string[];
  suggestions?: string[];
}

export interface ContractDrift {
  nodeId: string;
  driftType: 'input' | 'output' | 'both';
  changes: Array<{
    field: string;
    oldType: string;
    newType: string;
    breaking: boolean;
  }>;
}

export interface SampleDataGeneratorOptions {
  useDefaults?: boolean;
  seed?: number;
  locale?: string;
}

class SchemaValidationService {
  private static instance: SchemaValidationService;
  private ajv: Ajv;
  private validators: Map<string, ValidateFunction> = new Map();
  private schemaCache: Map<string, NodeSchema> = new Map();
  
  // Common schema definitions for workflow nodes
  private commonSchemas = {
    nodeOutput: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object' },
        error: { type: ['string', 'null'] },
        metadata: { 
          type: 'object',
          properties: {
            executionTime: { type: 'number' },
            memoryUsage: { type: 'number' }
          }
        }
      },
      required: ['success']
    },
    
    triggerData: {
      type: 'object',
      properties: {
        triggerId: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
        source: { type: 'string' },
        data: { type: 'object' }
      },
      required: ['triggerId', 'timestamp', 'source']
    },

    actionConfig: {
      type: 'object',
      properties: {
        actionType: { type: 'string' },
        targetId: { type: 'string' },
        parameters: { type: 'object' },
        timeout: { type: 'number', minimum: 1000, maximum: 300000 }
      },
      required: ['actionType']
    }
  };

  private constructor() {
    this.ajv = new Ajv({ 
      allErrors: true, 
      verbose: true,
      strict: false,
      addUsedSchema: false
    });
    
    // Add format validators
    addFormats(this.ajv);
    
    // Add custom formats
    this.ajv.addFormat('email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    this.ajv.addFormat('url', /^https?:\/\/.+/);
    this.ajv.addFormat('uuid', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    
    // Register common schemas
    Object.entries(this.commonSchemas).forEach(([name, schema]) => {
      this.ajv.addSchema(schema, name);
    });
  }

  static getInstance(): SchemaValidationService {
    if (!SchemaValidationService.instance) {
      SchemaValidationService.instance = new SchemaValidationService();
    }
    return SchemaValidationService.instance;
  }

  /**
   * Register or update node schema
   */
  async registerNodeSchema(
    workflowId: string,
    nodeId: string,
    nodeType: string,
    inputSchema: Record<string, any>,
    outputSchema: Record<string, any>
  ): Promise<boolean> {
    try {
      // Check for existing schema
      const { data: existing } = await supabase
        .from('workflow_contracts')
        .select('*')
        .eq('workflow_id', workflowId)
        .eq('node_id', nodeId)
        .eq('is_current', true)
        .single();

      let version = 1;
      if (existing) {
        // Mark existing as not current
        await supabase
          .from('workflow_contracts')
          .update({ is_current: false })
          .eq('id', existing.id);
        
        version = existing.version + 1;
      }

      // Insert new schema version
      const { error } = await supabase
        .from('workflow_contracts')
        .insert({
          workflow_id: workflowId,
          node_id: nodeId,
          node_type: nodeType,
          input_schema: inputSchema,
          output_schema: outputSchema,
          version: version,
          is_current: true
        });

      if (error) throw error;

      // Update cache
      const cacheKey = `${workflowId}-${nodeId}`;
      const schema: NodeSchema = {
        nodeId,
        nodeType,
        inputSchema,
        outputSchema,
        version
      };
      this.schemaCache.set(cacheKey, schema);

      // Compile validators
      this.compileValidator(`${cacheKey}-input`, inputSchema);
      this.compileValidator(`${cacheKey}-output`, outputSchema);

      logger.info(`Registered schema v${version} for node ${nodeId}`);
      return true;
    } catch (error) {
      logger.error('Failed to register node schema:', error);
      return false;
    }
  }

  /**
   * Validate data against node schema
   */
  async validateNodeData(
    workflowId: string,
    nodeId: string,
    data: any,
    schemaType: 'input' | 'output'
  ): Promise<SchemaValidationResult> {
    try {
      const cacheKey = `${workflowId}-${nodeId}`;
      let schema = this.schemaCache.get(cacheKey);

      if (!schema) {
        // Fetch from database
        const { data: dbSchema, error } = await supabase
          .from('workflow_contracts')
          .select('*')
          .eq('workflow_id', workflowId)
          .eq('node_id', nodeId)
          .eq('is_current', true)
          .single();

        if (error || !dbSchema) {
          return {
            isValid: false,
            errors: [{
              path: '',
              message: `Schema not found for node ${nodeId}`,
              keyword: 'missing',
              params: {}
            }]
          };
        }

        schema = {
          nodeId: dbSchema.node_id,
          nodeType: dbSchema.node_type,
          inputSchema: dbSchema.input_schema,
          outputSchema: dbSchema.output_schema,
          version: dbSchema.version
        };
        this.schemaCache.set(cacheKey, schema);
      }

      const validatorKey = `${cacheKey}-${schemaType}`;
      let validator = this.validators.get(validatorKey);

      if (!validator) {
        const schemaObj = schemaType === 'input' ? schema.inputSchema : schema.outputSchema;
        validator = this.compileValidator(validatorKey, schemaObj);
      }

      const isValid = validator(data);

      if (!isValid) {
        return {
          isValid: false,
          errors: validator.errors?.map(err => ({
            path: err.instancePath || err.schemaPath,
            message: err.message || 'Validation failed',
            keyword: err.keyword,
            params: err.params
          })),
          warnings: this.generateWarnings(data, schema, schemaType),
          suggestions: this.generateSuggestions(validator.errors || [])
        };
      }

      return {
        isValid: true,
        warnings: this.generateWarnings(data, schema, schemaType)
      };
    } catch (error) {
      logger.error('Failed to validate node data:', error);
      return {
        isValid: false,
        errors: [{
          path: '',
          message: 'Validation error: ' + (error as Error).message,
          keyword: 'error',
          params: {}
        }]
      };
    }
  }

  /**
   * Detect contract drift between schema versions
   */
  async detectContractDrift(
    workflowId: string,
    nodeId: string
  ): Promise<ContractDrift | null> {
    try {
      // Get all versions of the schema
      const { data: schemas, error } = await supabase
        .from('workflow_contracts')
        .select('*')
        .eq('workflow_id', workflowId)
        .eq('node_id', nodeId)
        .order('version', { ascending: false })
        .limit(2);

      if (error || !schemas || schemas.length < 2) {
        return null;
      }

      const [current, previous] = schemas;
      const changes: ContractDrift['changes'] = [];

      // Compare input schemas
      const inputChanges = this.compareSchemas(
        previous.input_schema,
        current.input_schema,
        'input'
      );
      changes.push(...inputChanges);

      // Compare output schemas
      const outputChanges = this.compareSchemas(
        previous.output_schema,
        current.output_schema,
        'output'
      );
      changes.push(...outputChanges);

      if (changes.length === 0) {
        return null;
      }

      const driftType = 
        inputChanges.length > 0 && outputChanges.length > 0 ? 'both' :
        inputChanges.length > 0 ? 'input' : 'output';

      return {
        nodeId,
        driftType,
        changes
      };
    } catch (error) {
      logger.error('Failed to detect contract drift:', error);
      return null;
    }
  }

  /**
   * Generate sample data from schema
   */
  generateSampleData(
    schema: Record<string, any>,
    options: SampleDataGeneratorOptions = {}
  ): any {
    const { useDefaults = true, seed = Date.now() } = options;
    
    // Simple deterministic random for consistent sample data
    let randomSeed = seed;
    const random = () => {
      randomSeed = (randomSeed * 9301 + 49297) % 233280;
      return randomSeed / 233280;
    };

    const generate = (schemaObj: any): any => {
      if (schemaObj.default !== undefined && useDefaults) {
        return schemaObj.default;
      }

      switch (schemaObj.type) {
        case 'string':
          if (schemaObj.enum) {
            return schemaObj.enum[Math.floor(random() * schemaObj.enum.length)];
          }
          if (schemaObj.format === 'date-time') {
            return new Date().toISOString();
          }
          if (schemaObj.format === 'email') {
            return 'test@example.com';
          }
          if (schemaObj.format === 'url') {
            return 'https://example.com';
          }
          if (schemaObj.format === 'uuid') {
            return 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
          }
          return schemaObj.example || 'sample string';

        case 'number':
        case 'integer':
          const min = schemaObj.minimum || 0;
          const max = schemaObj.maximum || 100;
          const value = min + random() * (max - min);
          return schemaObj.type === 'integer' ? Math.floor(value) : value;

        case 'boolean':
          return random() > 0.5;

        case 'array':
          const length = schemaObj.minItems || 1;
          const maxLength = schemaObj.maxItems || 5;
          const actualLength = Math.floor(length + random() * (maxLength - length));
          return Array.from({ length: actualLength }, () => 
            generate(schemaObj.items || {})
          );

        case 'object':
          const obj: any = {};
          if (schemaObj.properties) {
            for (const [key, propSchema] of Object.entries(schemaObj.properties)) {
              if (schemaObj.required?.includes(key) || random() > 0.3) {
                obj[key] = generate(propSchema);
              }
            }
          }
          return obj;

        case 'null':
          return null;

        default:
          if (Array.isArray(schemaObj.type)) {
            // Handle multiple types
            const typeIndex = Math.floor(random() * schemaObj.type.length);
            return generate({ ...schemaObj, type: schemaObj.type[typeIndex] });
          }
          return null;
      }
    };

    return generate(schema);
  }

  /**
   * Get schema autocomplete suggestions
   */
  getSchemaAutocomplete(
    schema: Record<string, any>,
    path: string
  ): Array<{ label: string; type: string; description?: string }> {
    const suggestions: Array<{ label: string; type: string; description?: string }> = [];
    
    const parts = path.split('.');
    let current = schema;

    // Navigate to current path
    for (const part of parts.slice(0, -1)) {
      if (current.type === 'object' && current.properties?.[part]) {
        current = current.properties[part];
      } else if (current.type === 'array' && current.items) {
        current = current.items;
      } else {
        return suggestions;
      }
    }

    // Generate suggestions for current level
    if (current.type === 'object' && current.properties) {
      const prefix = parts[parts.length - 1] || '';
      
      for (const [key, propSchema] of Object.entries(current.properties)) {
        if (key.startsWith(prefix)) {
          suggestions.push({
            label: key,
            type: (propSchema as any).type,
            description: (propSchema as any).description
          });
        }
      }
    }

    return suggestions;
  }

  /**
   * Compile and cache validator
   */
  private compileValidator(key: string, schema: Record<string, any>): ValidateFunction {
    try {
      const validator = this.ajv.compile(schema);
      this.validators.set(key, validator);
      return validator;
    } catch (error) {
      logger.error('Failed to compile schema validator:', error);
      // Return a validator that always fails
      const failValidator: ValidateFunction = () => false;
      failValidator.errors = [{
        keyword: 'compile',
        schemaPath: '',
        instancePath: '',
        params: {},
        message: 'Failed to compile schema'
      }];
      return failValidator;
    }
  }

  /**
   * Compare two schemas for changes
   */
  private compareSchemas(
    oldSchema: any,
    newSchema: any,
    prefix: string
  ): ContractDrift['changes'] {
    const changes: ContractDrift['changes'] = [];

    const compareProps = (old: any, newer: any, path: string = '') => {
      // Check for type changes
      if (old.type !== newer.type) {
        changes.push({
          field: path || prefix,
          oldType: old.type,
          newType: newer.type,
          breaking: true
        });
      }

      // Check for required field changes
      if (old.required && newer.required) {
        const oldRequired = new Set(old.required);
        const newRequired = new Set(newer.required);
        
        for (const field of oldRequired) {
          if (!newRequired.has(field)) {
            changes.push({
              field: path ? `${path}.${field}` : field,
              oldType: 'required',
              newType: 'optional',
              breaking: false
            });
          }
        }

        for (const field of newRequired) {
          if (!oldRequired.has(field)) {
            changes.push({
              field: path ? `${path}.${field}` : field,
              oldType: 'optional',
              newType: 'required',
              breaking: true
            });
          }
        }
      }

      // Recursively check object properties
      if (old.type === 'object' && newer.type === 'object') {
        const oldProps = old.properties || {};
        const newProps = newer.properties || {};
        
        const allKeys = new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);
        
        for (const key of allKeys) {
          const newPath = path ? `${path}.${key}` : key;
          
          if (oldProps[key] && !newProps[key]) {
            changes.push({
              field: newPath,
              oldType: oldProps[key].type,
              newType: 'removed',
              breaking: true
            });
          } else if (!oldProps[key] && newProps[key]) {
            changes.push({
              field: newPath,
              oldType: 'none',
              newType: newProps[key].type,
              breaking: false
            });
          } else if (oldProps[key] && newProps[key]) {
            compareProps(oldProps[key], newProps[key], newPath);
          }
        }
      }
    };

    compareProps(oldSchema, newSchema);
    return changes;
  }

  /**
   * Generate validation warnings
   */
  private generateWarnings(
    data: any,
    schema: NodeSchema,
    schemaType: 'input' | 'output'
  ): string[] {
    const warnings: string[] = [];
    const schemaObj = schemaType === 'input' ? schema.inputSchema : schema.outputSchema;

    // Check for deprecated fields
    if (schemaObj.deprecated) {
      warnings.push(`This ${schemaType} schema is deprecated and may be removed in future versions`);
    }

    // Check for missing recommended fields
    if (schemaObj.recommended) {
      for (const field of schemaObj.recommended) {
        if (!(field in data)) {
          warnings.push(`Recommended field '${field}' is missing`);
        }
      }
    }

    // Check for large payloads
    const dataSize = JSON.stringify(data).length;
    if (dataSize > 100000) {
      warnings.push(`Large ${schemaType} payload detected (${Math.round(dataSize / 1024)}KB)`);
    }

    return warnings;
  }

  /**
   * Generate validation suggestions
   */
  private generateSuggestions(errors: any[]): string[] {
    const suggestions: string[] = [];
    
    for (const error of errors) {
      switch (error.keyword) {
        case 'type':
          suggestions.push(
            `Field '${error.instancePath}' should be of type '${error.params.type}'`
          );
          break;
        case 'required':
          suggestions.push(
            `Add required field '${error.params.missingProperty}' to the data`
          );
          break;
        case 'enum':
          suggestions.push(
            `Field '${error.instancePath}' must be one of: ${error.params.allowedValues.join(', ')}`
          );
          break;
        case 'format':
          suggestions.push(
            `Field '${error.instancePath}' must match format '${error.params.format}'`
          );
          break;
        case 'minimum':
        case 'maximum':
          suggestions.push(
            `Field '${error.instancePath}' must be ${error.keyword} ${error.params.limit}`
          );
          break;
      }
    }

    return suggestions;
  }

  /**
   * Clear schema cache
   */
  clearCache(): void {
    this.schemaCache.clear();
    this.validators.clear();
  }
}

export const schemaValidationService = SchemaValidationService.getInstance();