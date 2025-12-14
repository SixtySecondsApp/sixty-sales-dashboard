| query                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | rolname        | calls  | mean_time        | min_time     | max_time     | total_time       | rows_read | cache_hit_rate       | prop_total_time     | index_advisor_result |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------ | ---------------- | ------------ | ------------ | ---------------- | --------- | -------------------- | ------------------- | -------------------- |
| SELECT wal->>$5 as type,
       wal->>$6 as schema,
       wal->>$7 as table,
       wal->>$8 as columns,
       wal->>$9 as record,
       wal->>$10 as old_record,
       wal->>$11 as commit_timestamp,
       subscription_ids,
       errors
FROM realtime.list_changes($1, $2, $3, $4)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | supabase_admin | 810037 | 4.65495696457324 | 3.334894     | 13812.165262 | 3770687.37471212 | 0         | 100.0000000000000000 | 89.6054455478558    | null                 |
| WITH pgrst_source AS ( SELECT "public"."meeting_attendees".* FROM "public"."meeting_attendees" WHERE  "public"."meeting_attendees"."meeting_id" = $1   LIMIT $2 OFFSET $3 )  SELECT $4::bigint AS total_result_set, pg_catalog.count(_postgrest_t) AS page_total, coalesce(json_agg(_postgrest_t), $5) AS body, nullif(current_setting($6, $7), $8) AS response_headers, nullif(current_setting($9, $10), $11) AS response_status, $12 AS response_inserted FROM ( SELECT * FROM pgrst_source ) _postgrest_t                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | authenticated  | 118    | 701.175277644068 | 0.296685     | 1077.27819   | 82738.682762     | 118       | 99.9997208068681510  | 1.9661764013246337  | null                 |
| select
        case when not exists (
          select $2
          from pg_replication_slots
          where slot_name = $1
        )
        then (
          select $3 from pg_create_logical_replication_slot($1, $4, $5)
        )
        else $6
        end                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | supabase_admin | 162    | 188.825983425926 | 7.525801     | 14423.472053 | 30589.809315     | 162       | 0                    | 0.7269267431919604  | null                 |
| WITH
-- Recursively get the base types of domains
base_types AS (
  WITH RECURSIVE
  recurse AS (
    SELECT
      oid,
      typbasetype,
      typnamespace AS base_namespace,
      COALESCE(NULLIF(typbasetype, $2), oid) AS base_type
    FROM pg_type
    UNION
    SELECT
      t.oid,
      b.typbasetype,
      b.typnamespace AS base_namespace,
      COALESCE(NULLIF(b.typbasetype, $3), b.oid) AS base_type
    FROM recurse t
    JOIN pg_type b ON t.typbasetype = b.oid
  )
  SELECT
    oid,
    base_namespace,
    base_type
  FROM recurse
  WHERE typbasetype = $4
),
columns AS (
    SELECT
        c.oid AS relid,
        a.attname::name AS column_name,
        d.description AS description,
        -- typbasetype and typdefaultbin handles `CREATE DOMAIN .. DEFAULT val`,  attidentity/attgenerated handles generated columns, pg_get_expr gets the default of a column
        CASE
          WHEN (t.typbasetype != $5) AND (ad.adbin IS NULL) THEN pg_get_expr(t.typdefaultbin, $6)
          WHEN a.attidentity  = $7 THEN format($8, seq.objid::regclass)
          WHEN a.attgenerated = $9 THEN $10
          ELSE pg_get_expr(ad.adbin, ad.adrelid)::text
        END AS column_default,
        not (a.attnotnull OR t.typtype = $11 AND t.typnotnull) AS is_nullable,
        CASE
            WHEN t.typtype = $12 THEN
            CASE
                WHEN bt.base_namespace = $13::regnamespace THEN format_type(bt.base_type, $14::integer)
                ELSE format_type(a.atttypid, a.atttypmod)
            END
            ELSE
            CASE
                WHEN t.typnamespace = $15::regnamespace THEN format_type(a.atttypid, $16::integer)
                ELSE format_type(a.atttypid, a.atttypmod)
            END
        END::text AS data_type,
        format_type(a.atttypid, a.atttypmod)::text AS nominal_data_type,
        information_schema._pg_char_max_length(
            information_schema._pg_truetypid(a.*, t.*),
            information_schema._pg_truetypmod(a.*, t.*)
        )::integer AS character_maximum_length,
        bt.base_type,
        a.attnum::integer AS position
    FROM pg_attribute a
        LEFT JOIN pg_description AS d
            ON d.objoid = a.attrelid and d.objsubid = a.attnum and d.classoid = $17::regclass
        LEFT JOIN pg_attrdef ad
            ON a.attrelid = ad.adrelid AND a.attnum = ad.adnum
        JOIN pg_class c
            ON a.attrelid = c.oid
        JOIN pg_type t
            ON a.atttypid = t.oid
        LEFT JOIN base_types bt
            ON t.oid = bt.oid
        LEFT JOIN pg_depend seq
            ON seq.refobjid = a.attrelid and seq.refobjsubid = a.attnum and seq.deptype = $18
    WHERE
        NOT pg_is_other_temp_schema(c.relnamespace)
        AND a.attnum > $19
        AND NOT a.attisdropped
        AND c.relkind in ($20, $21, $22, $23, $24)
        AND c.relnamespace = ANY($1::regnamespace[])
),
columns_agg AS (
  SELECT
    relid,
    array_agg(row(
      column_name,
      description,
      is_nullable::boolean,
      data_type,
      nominal_data_type,
      character_maximum_length,
      column_default,
      coalesce(
        (SELECT array_agg(enumlabel ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = base_type),
        $25
      )
    ) order by position) as columns
  FROM columns
  GROUP BY relid
),
tbl_pk_cols AS (
  SELECT
    r.oid AS relid,
    array_agg(a.attname ORDER BY a.attname) AS pk_cols
  FROM pg_class r
  JOIN pg_constraint c
    ON r.oid = c.conrelid
  JOIN pg_attribute a
    ON a.attrelid = r.oid AND a.attnum = ANY (c.conkey)
  WHERE
    c.contype in ($26)
    AND r.relkind IN ($27, $28)
    AND r.relnamespace NOT IN ($29::regnamespace, $30::regnamespace)
    AND NOT pg_is_other_temp_schema(r.relnamespace)
    AND NOT a.attisdropped
  GROUP BY r.oid
)
SELECT
  n.nspname AS table_schema,
  c.relname AS table_name,
  d.description AS table_description,
  c.relkind IN ($31,$32) as is_view,
  (
    c.relkind IN ($33,$34)
    OR (
      c.relkind in ($35,$36)
      -- The function `pg_relation_is_updateable` returns a bitmask where 8
      -- corresponds to `1 << CMD_INSERT` in the PostgreSQL source code, i.e.
      -- it's possible to insert into the relation.
      AND (pg_relation_is_updatable(c.oid::regclass, $37) & $38) = $39
    )
  ) AS insertable,
  (
    c.relkind IN ($40,$41)
    OR (
      c.relkind in ($42,$43)
      -- CMD_UPDATE
      AND (pg_relation_is_updatable(c.oid::regclass, $44) & $45) = $46
    )
  ) AS updatable,
  (
    c.relkind IN ($47,$48)
    OR (
      c.relkind in ($49,$50)
      -- CMD_DELETE
      AND (pg_relation_is_updatable(c.oid::regclass, $51) & $52) = $53
    )
  ) AS deletable,
  coalesce(tpks.pk_cols, $54) as pk_cols,
  coalesce(cols_agg.columns, $55) as columns
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_description d on d.objoid = c.oid and d.objsubid = $56 and d.classoid = $57::regclass
LEFT JOIN tbl_pk_cols tpks ON c.oid = tpks.relid
LEFT JOIN columns_agg cols_agg ON c.oid = cols_agg.relid
WHERE c.relkind IN ($58,$59,$60,$61,$62)
AND c.relnamespace NOT IN ($63::regnamespace, $64::regnamespace)
AND not c.relispartition
ORDER BY table_schema, table_name | authenticator  | 370    | 78.5854472702703 | 1.299876     | 2095.187458  | 29076.61549      | 58870     | 99.9983216096293672  | 0.6909676743498395  | null                 |
| SELECT name FROM pg_timezone_names                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | authenticator  | 370    | 70.6886573297297 | 52.723353    | 888.024187   | 26154.803212     | 441780    | 0                    | 0.6215346333787954  | null                 |
| with records as (
  select
    c.oid::int8 as "id",
    case c.relkind
      when $1 then pg_temp.pg_get_tabledef(
        concat(nc.nspname),
        concat(c.relname),
        $2,
        $3,
        $4
      )
      when $5 then concat(
        $6, concat(nc.nspname, $7, c.relname), $8,
        pg_get_viewdef(concat(nc.nspname, $9, c.relname), $10)
      )
      when $11 then concat(
        $12, concat(nc.nspname, $13, c.relname), $14,
        pg_get_viewdef(concat(nc.nspname, $15, c.relname), $16)
      )
      when $17 then concat($18, nc.nspname, $19, c.relname, $20)
      when $21 then pg_temp.pg_get_tabledef(
        concat(nc.nspname),
        concat(c.relname),
        $22,
        $23,
        $24
      )
    end as "sql"
  from
    pg_namespace nc
    join pg_class c on nc.oid = c.relnamespace
  where
    c.relkind in ($25, $26, $27, $28, $29)
    and not pg_is_other_temp_schema(nc.oid)
    and (
      pg_has_role(c.relowner, $30)
      or has_table_privilege(
        c.oid,
        $31
      )
      or has_any_column_privilege(c.oid, $32)
    )
    and nc.nspname IN ($33)
  order by c.relname asc
  limit $34
  offset $35
)
select
  jsonb_build_object(
    $36, coalesce(jsonb_agg(
      jsonb_build_object(
        $37, r.id,
        $38, r.sql
      )
    ), $39::jsonb)
  ) "data"
from records r                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | postgres       | 1      | 19590.779103     | 19590.779103 | 19590.779103 | 19590.779103     | 1         | 100.0000000000000000 | 0.4655491998426309  | null                 |
| with records as (
  select
    c.oid::int8 as "id",
    case c.relkind
      when $1 then pg_temp.pg_get_tabledef(
        concat(nc.nspname),
        concat(c.relname),
        $2,
        $3,
        $4
      )
      when $5 then concat(
        $6, concat(nc.nspname, $7, c.relname), $8,
        pg_get_viewdef(concat(nc.nspname, $9, c.relname), $10)
      )
      when $11 then concat(
        $12, concat(nc.nspname, $13, c.relname), $14,
        pg_get_viewdef(concat(nc.nspname, $15, c.relname), $16)
      )
      when $17 then concat($18, nc.nspname, $19, c.relname, $20)
      when $21 then pg_temp.pg_get_tabledef(
        concat(nc.nspname),
        concat(c.relname),
        $22,
        $23,
        $24
      )
    end as "sql"
  from
    pg_namespace nc
    join pg_class c on nc.oid = c.relnamespace
  where
    c.relkind in ($25, $26, $27, $28, $29)
    and not pg_is_other_temp_schema(nc.oid)
    and (
      pg_has_role(c.relowner, $30)
      or has_table_privilege(
        c.oid,
        $31
      )
      or has_any_column_privilege(c.oid, $32)
    )
    and nc.nspname IN ($33)
  order by c.relname asc
  limit $34
  offset $35
)
select
  jsonb_build_object(
    $36, coalesce(jsonb_agg(
      jsonb_build_object(
        $37, r.id,
        $38, r.sql
      )
    ), $39::jsonb)
  ) "data"
from records r                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | postgres       | 1      | 19413.794757     | 19413.794757 | 19413.794757 | 19413.794757     | 1         | 100.0000000000000000 | 0.46134339872406516 | null                 |
| with records as (
  select
    c.oid::int8 as "id",
    case c.relkind
      when $1 then pg_temp.pg_get_tabledef(
        concat(nc.nspname),
        concat(c.relname),
        $2,
        $3,
        $4
      )
      when $5 then concat(
        $6, concat(nc.nspname, $7, c.relname), $8,
        pg_get_viewdef(concat(nc.nspname, $9, c.relname), $10)
      )
      when $11 then concat(
        $12, concat(nc.nspname, $13, c.relname), $14,
        pg_get_viewdef(concat(nc.nspname, $15, c.relname), $16)
      )
      when $17 then concat($18, nc.nspname, $19, c.relname, $20)
      when $21 then pg_temp.pg_get_tabledef(
        concat(nc.nspname),
        concat(c.relname),
        $22,
        $23,
        $24
      )
    end as "sql"
  from
    pg_namespace nc
    join pg_class c on nc.oid = c.relnamespace
  where
    c.relkind in ($25, $26, $27, $28, $29)
    and not pg_is_other_temp_schema(nc.oid)
    and (
      pg_has_role(c.relowner, $30)
      or has_table_privilege(
        c.oid,
        $31
      )
      or has_any_column_privilege(c.oid, $32)
    )
    and nc.nspname IN ($33)
  order by c.relname asc
  limit $34
  offset $35
)
select
  jsonb_build_object(
    $36, coalesce(jsonb_agg(
      jsonb_build_object(
        $37, r.id,
        $38, r.sql
      )
    ), $39::jsonb)
  ) "data"
from records r                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | postgres       | 1      | 19328.038354     | 19328.038354 | 19328.038354 | 19328.038354     | 1         | 99.9998108335619094  | 0.4593055101547474  | null                 |
| with records as (
  select
    c.oid::int8 as "id",
    case c.relkind
      when $1 then pg_temp.pg_get_tabledef(
        concat(nc.nspname),
        concat(c.relname),
        $2,
        $3,
        $4
      )
      when $5 then concat(
        $6, concat(nc.nspname, $7, c.relname), $8,
        pg_get_viewdef(concat(nc.nspname, $9, c.relname), $10)
      )
      when $11 then concat(
        $12, concat(nc.nspname, $13, c.relname), $14,
        pg_get_viewdef(concat(nc.nspname, $15, c.relname), $16)
      )
      when $17 then concat($18, nc.nspname, $19, c.relname, $20)
      when $21 then pg_temp.pg_get_tabledef(
        concat(nc.nspname),
        concat(c.relname),
        $22,
        $23,
        $24
      )
    end as "sql"
  from
    pg_namespace nc
    join pg_class c on nc.oid = c.relnamespace
  where
    c.relkind in ($25, $26, $27, $28, $29)
    and not pg_is_other_temp_schema(nc.oid)
    and (
      pg_has_role(c.relowner, $30)
      or has_table_privilege(
        c.oid,
        $31
      )
      or has_any_column_privilege(c.oid, $32)
    )
    and nc.nspname IN ($33)
  order by c.relname asc
  limit $34
  offset $35
)
select
  jsonb_build_object(
    $36, coalesce(jsonb_agg(
      jsonb_build_object(
        $37, r.id,
        $38, r.sql
      )
    ), $39::jsonb)
  ) "data"
from records r                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | postgres       | 1      | 18491.635295     | 18491.635295 | 18491.635295 | 18491.635295     | 1         | 100.0000000000000000 | 0.43942948721476377 | null                 |
| with records as (
  select
    c.oid::int8 as "id",
    case c.relkind
      when $1 then pg_temp.pg_get_tabledef(
        concat(nc.nspname),
        concat(c.relname),
        $2,
        $3,
        $4
      )
      when $5 then concat(
        $6, concat(nc.nspname, $7, c.relname), $8,
        pg_get_viewdef(concat(nc.nspname, $9, c.relname), $10)
      )
      when $11 then concat(
        $12, concat(nc.nspname, $13, c.relname), $14,
        pg_get_viewdef(concat(nc.nspname, $15, c.relname), $16)
      )
      when $17 then concat($18, nc.nspname, $19, c.relname, $20)
      when $21 then pg_temp.pg_get_tabledef(
        concat(nc.nspname),
        concat(c.relname),
        $22,
        $23,
        $24
      )
    end as "sql"
  from
    pg_namespace nc
    join pg_class c on nc.oid = c.relnamespace
  where
    c.relkind in ($25, $26, $27, $28, $29)
    and not pg_is_other_temp_schema(nc.oid)
    and (
      pg_has_role(c.relowner, $30)
      or has_table_privilege(
        c.oid,
        $31
      )
      or has_any_column_privilege(c.oid, $32)
    )
    and nc.nspname IN ($33)
  order by c.relname asc
  limit $34
  offset $35
)
select
  jsonb_build_object(
    $36, coalesce(jsonb_agg(
      jsonb_build_object(
        $37, r.id,
        $38, r.sql
      )
    ), $39::jsonb)
  ) "data"
from records r                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | postgres       | 1      | 18380.974397     | 18380.974397 | 18380.974397 | 18380.974397     | 1         | 100.0000000000000000 | 0.43679977594871844 | null                 |
| with records as (
  select
    c.oid::int8 as "id",
    case c.relkind
      when $1 then pg_temp.pg_get_tabledef(
        concat(nc.nspname),
        concat(c.relname),
        $2,
        $3,
        $4
      )
      when $5 then concat(
        $6, concat(nc.nspname, $7, c.relname), $8,
        pg_get_viewdef(concat(nc.nspname, $9, c.relname), $10)
      )
      when $11 then concat(
        $12, concat(nc.nspname, $13, c.relname), $14,
        pg_get_viewdef(concat(nc.nspname, $15, c.relname), $16)
      )
      when $17 then concat($18, nc.nspname, $19, c.relname, $20)
      when $21 then pg_temp.pg_get_tabledef(
        concat(nc.nspname),
        concat(c.relname),
        $22,
        $23,
        $24
      )
    end as "sql"
  from
    pg_namespace nc
    join pg_class c on nc.oid = c.relnamespace
  where
    c.relkind in ($25, $26, $27, $28, $29)
    and not pg_is_other_temp_schema(nc.oid)
    and (
      pg_has_role(c.relowner, $30)
      or has_table_privilege(
        c.oid,
        $31
      )
      or has_any_column_privilege(c.oid, $32)
    )
    and nc.nspname IN ($33)
  order by c.relname asc
  limit $34
  offset $35
)
select
  jsonb_build_object(
    $36, coalesce(jsonb_agg(
      jsonb_build_object(
        $37, r.id,
        $38, r.sql
      )
    ), $39::jsonb)
  ) "data"
from records r                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | postgres       | 1      | 18199.687504     | 18199.687504 | 18199.687504 | 18199.687504     | 1         | 100.0000000000000000 | 0.43249173043739    | null                 |
| with records as (
  select
    c.oid::int8 as "id",
    case c.relkind
      when $1 then pg_temp.pg_get_tabledef(
        concat(nc.nspname),
        concat(c.relname),
        $2,
        $3,
        $4
      )
      when $5 then concat(
        $6, concat(nc.nspname, $7, c.relname), $8,
        pg_get_viewdef(concat(nc.nspname, $9, c.relname), $10)
      )
      when $11 then concat(
        $12, concat(nc.nspname, $13, c.relname), $14,
        pg_get_viewdef(concat(nc.nspname, $15, c.relname), $16)
      )
      when $17 then concat($18, nc.nspname, $19, c.relname, $20)
      when $21 then pg_temp.pg_get_tabledef(
        concat(nc.nspname),
        concat(c.relname),
        $22,
        $23,
        $24
      )
    end as "sql"
  from
    pg_namespace nc
    join pg_class c on nc.oid = c.relnamespace
  where
    c.relkind in ($25, $26, $27, $28, $29)
    and not pg_is_other_temp_schema(nc.oid)
    and (
      pg_has_role(c.relowner, $30)
      or has_table_privilege(
        c.oid,
        $31
      )
      or has_any_column_privilege(c.oid, $32)
    )
    and nc.nspname IN ($33)
  order by c.relname asc
  limit $34
  offset $35
)
select
  jsonb_build_object(
    $36, coalesce(jsonb_agg(
      jsonb_build_object(
        $37, r.id,
        $38, r.sql
      )
    ), $39::jsonb)
  ) "data"
from records r                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | postgres       | 1      | 17851.734732     | 17851.734732 | 17851.734732 | 17851.734732     | 1         | 100.0000000000000000 | 0.42422308865770597 | null                 |
| with records as (
  select
    c.oid::int8 as "id",
    case c.relkind
      when $1 then pg_temp.pg_get_tabledef(
        concat(nc.nspname),
        concat(c.relname),
        $2,
        $3,
        $4
      )
      when $5 then concat(
        $6, concat(nc.nspname, $7, c.relname), $8,
        pg_get_viewdef(concat(nc.nspname, $9, c.relname), $10)
      )
      when $11 then concat(
        $12, concat(nc.nspname, $13, c.relname), $14,
        pg_get_viewdef(concat(nc.nspname, $15, c.relname), $16)
      )
      when $17 then concat($18, nc.nspname, $19, c.relname, $20)
      when $21 then pg_temp.pg_get_tabledef(
        concat(nc.nspname),
        concat(c.relname),
        $22,
        $23,
        $24
      )
    end as "sql"
  from
    pg_namespace nc
    join pg_class c on nc.oid = c.relnamespace
  where
    c.relkind in ($25, $26, $27, $28, $29)
    and not pg_is_other_temp_schema(nc.oid)
    and (
      pg_has_role(c.relowner, $30)
      or has_table_privilege(
        c.oid,
        $31
      )
      or has_any_column_privilege(c.oid, $32)
    )
    and nc.nspname IN ($33)
  order by c.relname asc
  limit $34
  offset $35
)
select
  jsonb_build_object(
    $36, coalesce(jsonb_agg(
      jsonb_build_object(
        $37, r.id,
        $38, r.sql
      )
    ), $39::jsonb)
  ) "data"
from records r                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | postgres       | 1      | 17640.009935     | 17640.009935 | 17640.009935 | 17640.009935     | 1         | 100.0000000000000000 | 0.419191726233988   | null                 |
| with records as (
  select
    c.oid::int8 as "id",
    case c.relkind
      when $1 then pg_temp.pg_get_tabledef(
        concat(nc.nspname),
        concat(c.relname),
        $2,
        $3,
        $4
      )
      when $5 then concat(
        $6, concat(nc.nspname, $7, c.relname), $8,
        pg_get_viewdef(concat(nc.nspname, $9, c.relname), $10)
      )
      when $11 then concat(
        $12, concat(nc.nspname, $13, c.relname), $14,
        pg_get_viewdef(concat(nc.nspname, $15, c.relname), $16)
      )
      when $17 then concat($18, nc.nspname, $19, c.relname, $20)
      when $21 then pg_temp.pg_get_tabledef(
        concat(nc.nspname),
        concat(c.relname),
        $22,
        $23,
        $24
      )
    end as "sql"
  from
    pg_namespace nc
    join pg_class c on nc.oid = c.relnamespace
  where
    c.relkind in ($25, $26, $27, $28, $29)
    and not pg_is_other_temp_schema(nc.oid)
    and (
      pg_has_role(c.relowner, $30)
      or has_table_privilege(
        c.oid,
        $31
      )
      or has_any_column_privilege(c.oid, $32)
    )
    and nc.nspname IN ($33)
  order by c.relname asc
  limit $34
  offset $35
)
select
  jsonb_build_object(
    $36, coalesce(jsonb_agg(
      jsonb_build_object(
        $37, r.id,
        $38, r.sql
      )
    ), $39::jsonb)
  ) "data"
from records r                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | postgres       | 1      | 17535.997213     | 17535.997213 | 17535.997213 | 17535.997213     | 1         | 100.0000000000000000 | 0.41672000016092237 | null                 |
| with records as (
  select
    c.oid::int8 as "id",
    case c.relkind
      when $1 then pg_temp.pg_get_tabledef(
        concat(nc.nspname),
        concat(c.relname),
        $2,
        $3,
        $4
      )
      when $5 then concat(
        $6, concat(nc.nspname, $7, c.relname), $8,
        pg_get_viewdef(concat(nc.nspname, $9, c.relname), $10)
      )
      when $11 then concat(
        $12, concat(nc.nspname, $13, c.relname), $14,
        pg_get_viewdef(concat(nc.nspname, $15, c.relname), $16)
      )
      when $17 then concat($18, nc.nspname, $19, c.relname, $20)
      when $21 then pg_temp.pg_get_tabledef(
        concat(nc.nspname),
        concat(c.relname),
        $22,
        $23,
        $24
      )
    end as "sql"
  from
    pg_namespace nc
    join pg_class c on nc.oid = c.relnamespace
  where
    c.relkind in ($25, $26, $27, $28, $29)
    and not pg_is_other_temp_schema(nc.oid)
    and (
      pg_has_role(c.relowner, $30)
      or has_table_privilege(
        c.oid,
        $31
      )
      or has_any_column_privilege(c.oid, $32)
    )
    and nc.nspname IN ($33)
  order by c.relname asc
  limit $34
  offset $35
)
select
  jsonb_build_object(
    $36, coalesce(jsonb_agg(
      jsonb_build_object(
        $37, r.id,
        $38, r.sql
      )
    ), $39::jsonb)
  ) "data"
from records r                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | postgres       | 1      | 17277.637327     | 17277.637327 | 17277.637327 | 17277.637327     | 1         | 100.0000000000000000 | 0.41058041594294126 | null                 |
| with records as (
  select
    c.oid::int8 as "id",
    case c.relkind
      when $1 then pg_temp.pg_get_tabledef(
        concat(nc.nspname),
        concat(c.relname),
        $2,
        $3,
        $4
      )
      when $5 then concat(
        $6, concat(nc.nspname, $7, c.relname), $8,
        pg_get_viewdef(concat(nc.nspname, $9, c.relname), $10)
      )
      when $11 then concat(
        $12, concat(nc.nspname, $13, c.relname), $14,
        pg_get_viewdef(concat(nc.nspname, $15, c.relname), $16)
      )
      when $17 then concat($18, nc.nspname, $19, c.relname, $20)
      when $21 then pg_temp.pg_get_tabledef(
        concat(nc.nspname),
        concat(c.relname),
        $22,
        $23,
        $24
      )
    end as "sql"
  from
    pg_namespace nc
    join pg_class c on nc.oid = c.relnamespace
  where
    c.relkind in ($25, $26, $27, $28, $29)
    and not pg_is_other_temp_schema(nc.oid)
    and (
      pg_has_role(c.relowner, $30)
      or has_table_privilege(
        c.oid,
        $31
      )
      or has_any_column_privilege(c.oid, $32)
    )
    and nc.nspname IN ($33)
  order by c.relname asc
  limit $34
  offset $35
)
select
  jsonb_build_object(
    $36, coalesce(jsonb_agg(
      jsonb_build_object(
        $37, r.id,
        $38, r.sql
      )
    ), $39::jsonb)
  ) "data"
from records r                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | postgres       | 1      | 17132.660597     | 17132.660597 | 17132.660597 | 17132.660597     | 1         | 100.0000000000000000 | 0.4071352338859925  | null                 |
| with records as (
  select
    c.oid::int8 as "id",
    case c.relkind
      when $1 then pg_temp.pg_get_tabledef(
        concat(nc.nspname),
        concat(c.relname),
        $2,
        $3,
        $4
      )
      when $5 then concat(
        $6, concat(nc.nspname, $7, c.relname), $8,
        pg_get_viewdef(concat(nc.nspname, $9, c.relname), $10)
      )
      when $11 then concat(
        $12, concat(nc.nspname, $13, c.relname), $14,
        pg_get_viewdef(concat(nc.nspname, $15, c.relname), $16)
      )
      when $17 then concat($18, nc.nspname, $19, c.relname, $20)
      when $21 then pg_temp.pg_get_tabledef(
        concat(nc.nspname),
        concat(c.relname),
        $22,
        $23,
        $24
      )
    end as "sql"
  from
    pg_namespace nc
    join pg_class c on nc.oid = c.relnamespace
  where
    c.relkind in ($25, $26, $27, $28, $29)
    and not pg_is_other_temp_schema(nc.oid)
    and (
      pg_has_role(c.relowner, $30)
      or has_table_privilege(
        c.oid,
        $31
      )
      or has_any_column_privilege(c.oid, $32)
    )
    and nc.nspname IN ($33)
  order by c.relname asc
  limit $34
  offset $35
)
select
  jsonb_build_object(
    $36, coalesce(jsonb_agg(
      jsonb_build_object(
        $37, r.id,
        $38, r.sql
      )
    ), $39::jsonb)
  ) "data"
from records r                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | postgres       | 1      | 17090.983144     | 17090.983144 | 17090.983144 | 17090.983144     | 1         | 100.0000000000000000 | 0.4061448238163564  | null                 |
| with records as (
  select
    c.oid::int8 as "id",
    case c.relkind
      when $1 then pg_temp.pg_get_tabledef(
        concat(nc.nspname),
        concat(c.relname),
        $2,
        $3,
        $4
      )
      when $5 then concat(
        $6, concat(nc.nspname, $7, c.relname), $8,
        pg_get_viewdef(concat(nc.nspname, $9, c.relname), $10)
      )
      when $11 then concat(
        $12, concat(nc.nspname, $13, c.relname), $14,
        pg_get_viewdef(concat(nc.nspname, $15, c.relname), $16)
      )
      when $17 then concat($18, nc.nspname, $19, c.relname, $20)
      when $21 then pg_temp.pg_get_tabledef(
        concat(nc.nspname),
        concat(c.relname),
        $22,
        $23,
        $24
      )
    end as "sql"
  from
    pg_namespace nc
    join pg_class c on nc.oid = c.relnamespace
  where
    c.relkind in ($25, $26, $27, $28, $29)
    and not pg_is_other_temp_schema(nc.oid)
    and (
      pg_has_role(c.relowner, $30)
      or has_table_privilege(
        c.oid,
        $31
      )
      or has_any_column_privilege(c.oid, $32)
    )
    and nc.nspname IN ($33)
  order by c.relname asc
  limit $34
  offset $35
)
select
  jsonb_build_object(
    $36, coalesce(jsonb_agg(
      jsonb_build_object(
        $37, r.id,
        $38, r.sql
      )
    ), $39::jsonb)
  ) "data"
from records r                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | postgres       | 1      | 17002.653989     | 17002.653989 | 17002.653989 | 17002.653989     | 1         | 100.0000000000000000 | 0.4040457971662764  | null                 |
| with records as (
  select
    c.oid::int8 as "id",
    case c.relkind
      when $1 then pg_temp.pg_get_tabledef(
        concat(nc.nspname),
        concat(c.relname),
        $2,
        $3,
        $4
      )
      when $5 then concat(
        $6, concat(nc.nspname, $7, c.relname), $8,
        pg_get_viewdef(concat(nc.nspname, $9, c.relname), $10)
      )
      when $11 then concat(
        $12, concat(nc.nspname, $13, c.relname), $14,
        pg_get_viewdef(concat(nc.nspname, $15, c.relname), $16)
      )
      when $17 then concat($18, nc.nspname, $19, c.relname, $20)
      when $21 then pg_temp.pg_get_tabledef(
        concat(nc.nspname),
        concat(c.relname),
        $22,
        $23,
        $24
      )
    end as "sql"
  from
    pg_namespace nc
    join pg_class c on nc.oid = c.relnamespace
  where
    c.relkind in ($25, $26, $27, $28, $29)
    and not pg_is_other_temp_schema(nc.oid)
    and (
      pg_has_role(c.relowner, $30)
      or has_table_privilege(
        c.oid,
        $31
      )
      or has_any_column_privilege(c.oid, $32)
    )
    and nc.nspname IN ($33)
  order by c.relname asc
  limit $34
  offset $35
)
select
  jsonb_build_object(
    $36, coalesce(jsonb_agg(
      jsonb_build_object(
        $37, r.id,
        $38, r.sql
      )
    ), $39::jsonb)
  ) "data"
from records r                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | postgres       | 1      | 16966.013589     | 16966.013589 | 16966.013589 | 16966.013589     | 1         | 100.0000000000000000 | 0.40317508606222946 | null                 |
| with records as (
  select
    c.oid::int8 as "id",
    case c.relkind
      when $1 then pg_temp.pg_get_tabledef(
        concat(nc.nspname),
        concat(c.relname),
        $2,
        $3,
        $4
      )
      when $5 then concat(
        $6, concat(nc.nspname, $7, c.relname), $8,
        pg_get_viewdef(concat(nc.nspname, $9, c.relname), $10)
      )
      when $11 then concat(
        $12, concat(nc.nspname, $13, c.relname), $14,
        pg_get_viewdef(concat(nc.nspname, $15, c.relname), $16)
      )
      when $17 then concat($18, nc.nspname, $19, c.relname, $20)
      when $21 then pg_temp.pg_get_tabledef(
        concat(nc.nspname),
        concat(c.relname),
        $22,
        $23,
        $24
      )
    end as "sql"
  from
    pg_namespace nc
    join pg_class c on nc.oid = c.relnamespace
  where
    c.relkind in ($25, $26, $27, $28, $29)
    and not pg_is_other_temp_schema(nc.oid)
    and (
      pg_has_role(c.relowner, $30)
      or has_table_privilege(
        c.oid,
        $31
      )
      or has_any_column_privilege(c.oid, $32)
    )
    and nc.nspname IN ($33)
  order by c.relname asc
  limit $34
  offset $35
)
select
  jsonb_build_object(
    $36, coalesce(jsonb_agg(
      jsonb_build_object(
        $37, r.id,
        $38, r.sql
      )
    ), $39::jsonb)
  ) "data"
from records r                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | postgres       | 1      | 16950.807179     | 16950.807179 | 16950.807179 | 16950.807179     | 1         | 100.0000000000000000 | 0.4028137256502336  | null                 |