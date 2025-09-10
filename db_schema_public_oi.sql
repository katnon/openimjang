--
-- PostgreSQL database dump
--

-- Dumped from database version 15.13
-- Dumped by pg_dump version 15.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: oi; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA oi;


ALTER SCHEMA oi OWNER TO postgres;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
  END;
  $$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ai_smart_summary; Type: TABLE; Schema: oi; Owner: postgres
--

CREATE TABLE oi.ai_smart_summary (
    apt_id integer NOT NULL,
    apt_nm character varying(255) NOT NULL,
    jibun_address text NOT NULL,
    summary text NOT NULL,
    user_id character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE oi.ai_smart_summary OWNER TO postgres;

--
-- Name: apt_building_info; Type: TABLE; Schema: oi; Owner: postgres
--

CREATE TABLE oi.apt_building_info (
    id integer NOT NULL,
    apt_id integer,
    type character varying(10) NOT NULL,
    dongnm character varying(100),
    bldnm character varying(200),
    platplc text,
    platarea numeric,
    archarea numeric,
    totarea numeric,
    grndflrcnt integer,
    ugrndflrcnt integer,
    mainpurpscdnm character varying(200),
    strctcdnm character varying(200),
    roofcdnm character varying(200),
    hhldcnt integer,
    mainbldcnt integer,
    atchbldcnt integer,
    totpkngcnt integer,
    useaprday date,
    raw_data jsonb,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE oi.apt_building_info OWNER TO postgres;

--
-- Name: apt_building_info_id_seq; Type: SEQUENCE; Schema: oi; Owner: postgres
--

CREATE SEQUENCE oi.apt_building_info_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE oi.apt_building_info_id_seq OWNER TO postgres;

--
-- Name: apt_building_info_id_seq; Type: SEQUENCE OWNED BY; Schema: oi; Owner: postgres
--

ALTER SEQUENCE oi.apt_building_info_id_seq OWNED BY oi.apt_building_info.id;


--
-- Name: apt_deal_all; Type: TABLE; Schema: oi; Owner: postgres
--

CREATE TABLE oi.apt_deal_all (
    id integer NOT NULL,
    apt_nm text NOT NULL,
    apt_dong text,
    jibun_address text NOT NULL,
    exclu_use_ar numeric(10,2),
    floor integer,
    deal_year integer NOT NULL,
    deal_month integer NOT NULL,
    deal_day integer NOT NULL,
    deal_amount integer,
    deposit integer,
    monthly_rent integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE oi.apt_deal_all OWNER TO postgres;

--
-- Name: apt_deal_all_id_seq; Type: SEQUENCE; Schema: oi; Owner: postgres
--

CREATE SEQUENCE oi.apt_deal_all_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE oi.apt_deal_all_id_seq OWNER TO postgres;

--
-- Name: apt_deal_all_id_seq; Type: SEQUENCE OWNED BY; Schema: oi; Owner: postgres
--

ALTER SEQUENCE oi.apt_deal_all_id_seq OWNED BY oi.apt_deal_all.id;


--
-- Name: apt_deal_rent_raw; Type: TABLE; Schema: oi; Owner: postgres
--

CREATE TABLE oi.apt_deal_rent_raw (
    id integer NOT NULL,
    sggcd text,
    umdnm text,
    aptnm text,
    jibun text,
    excluusear numeric,
    dealyear integer,
    dealmonth integer,
    dealday integer,
    deposit integer,
    monthlyrent integer,
    floor integer,
    buildyear integer,
    contractterm text,
    contracttype text,
    userrright text,
    predeposit integer,
    premonthlyrent integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE oi.apt_deal_rent_raw OWNER TO postgres;

--
-- Name: apt_deal_rent_raw_id_seq; Type: SEQUENCE; Schema: oi; Owner: postgres
--

CREATE SEQUENCE oi.apt_deal_rent_raw_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE oi.apt_deal_rent_raw_id_seq OWNER TO postgres;

--
-- Name: apt_deal_rent_raw_id_seq; Type: SEQUENCE OWNED BY; Schema: oi; Owner: postgres
--

ALTER SEQUENCE oi.apt_deal_rent_raw_id_seq OWNED BY oi.apt_deal_rent_raw.id;


--
-- Name: apt_deal_trade_raw; Type: TABLE; Schema: oi; Owner: postgres
--

CREATE TABLE oi.apt_deal_trade_raw (
    id integer NOT NULL,
    sggcd character varying(5),
    umdcd character varying(5),
    landcd character varying(1),
    bonbun character varying(4),
    bubun character varying(4),
    roadnm character varying(100),
    roadnmsggcd character varying(5),
    roadnmcd character varying(7),
    roadnmseq character varying(2),
    roadnmbascd character varying(1),
    roadnmbonbun character varying(5),
    roadnmbubun character varying(5),
    umdnm character varying(60),
    aptnm character varying(100),
    jibun character varying(20),
    excluusear numeric(10,4),
    dealyear integer,
    dealmonth integer,
    dealday integer,
    dealamount integer,
    floor integer,
    buildyear integer,
    aptseq character varying(20),
    cdealtype character varying(1),
    cdealday character varying(8),
    dealinggbn character varying(10),
    estateagentsggnm character varying(100),
    rgstdate character varying(8),
    aptdong character varying(400),
    slergbn character varying(100),
    buyergbn character varying(100),
    landleaseholdgbn character varying(1),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    roadnmbcd character varying(1)
);


ALTER TABLE oi.apt_deal_trade_raw OWNER TO postgres;

--
-- Name: apt_deal_trade_raw_id_seq; Type: SEQUENCE; Schema: oi; Owner: postgres
--

CREATE SEQUENCE oi.apt_deal_trade_raw_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE oi.apt_deal_trade_raw_id_seq OWNER TO postgres;

--
-- Name: apt_deal_trade_raw_id_seq; Type: SEQUENCE OWNED BY; Schema: oi; Owner: postgres
--

ALTER SEQUENCE oi.apt_deal_trade_raw_id_seq OWNED BY oi.apt_deal_trade_raw.id;


--
-- Name: apt_info; Type: TABLE; Schema: oi; Owner: postgres
--

CREATE TABLE oi.apt_info (
    id integer NOT NULL,
    apt_nm text NOT NULL,
    jibun_address text,
    lon double precision,
    lat double precision,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE oi.apt_info OWNER TO postgres;

--
-- Name: apt_info_id_seq; Type: SEQUENCE; Schema: oi; Owner: postgres
--

CREATE SEQUENCE oi.apt_info_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE oi.apt_info_id_seq OWNER TO postgres;

--
-- Name: apt_info_id_seq; Type: SEQUENCE OWNED BY; Schema: oi; Owner: postgres
--

ALTER SEQUENCE oi.apt_info_id_seq OWNED BY oi.apt_info.id;


--
-- Name: landuse_included; Type: TABLE; Schema: oi; Owner: postgres
--

CREATE TABLE oi.landuse_included (
    gid integer,
    geom public.geometry(MultiPolygon,5186),
    code text,
    pnu text,
    pnu_sgg text,
    pnu_umd text,
    pnu_landcd text,
    pnu_bonbun text,
    pnu_bubun text
);


ALTER TABLE oi.landuse_included OWNER TO postgres;

--
-- Name: legal_dong; Type: TABLE; Schema: oi; Owner: postgres
--

CREATE TABLE oi.legal_dong (
    code character varying(10) NOT NULL,
    sido character varying(20),
    sigungu character varying(40),
    eupmyeondong character varying(40),
    ri character varying(40)
);


ALTER TABLE oi.legal_dong OWNER TO postgres;

--
-- Name: old_apt_deal_all; Type: TABLE; Schema: oi; Owner: postgres
--

CREATE TABLE oi.old_apt_deal_all (
    id integer,
    apt_nm text,
    apt_dong text,
    jibun_address text,
    exclu_use_ar numeric(10,2),
    floor integer,
    deal_year integer,
    deal_month integer,
    deal_day integer,
    deal_amount integer,
    deposit integer,
    monthly_rent integer,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


ALTER TABLE oi.old_apt_deal_all OWNER TO postgres;

--
-- Name: old_apt_deal_rent_raw; Type: TABLE; Schema: oi; Owner: postgres
--

CREATE TABLE oi.old_apt_deal_rent_raw (
    id integer,
    sggcd text,
    umdnm text,
    aptnm text,
    jibun text,
    excluusear numeric,
    dealyear integer,
    dealmonth integer,
    dealday integer,
    deposit integer,
    monthlyrent integer,
    floor integer,
    buildyear integer,
    contractterm text,
    contracttype text,
    userrright text,
    predeposit integer,
    premonthlyrent integer,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


ALTER TABLE oi.old_apt_deal_rent_raw OWNER TO postgres;

--
-- Name: old_apt_deal_trade_raw; Type: TABLE; Schema: oi; Owner: postgres
--

CREATE TABLE oi.old_apt_deal_trade_raw (
    id integer,
    sggcd character varying(5),
    umdcd character varying(5),
    landcd character varying(1),
    bonbun character varying(4),
    bubun character varying(4),
    roadnm character varying(100),
    roadnmsggcd character varying(5),
    roadnmcd character varying(7),
    roadnmseq character varying(2),
    roadnmbascd character varying(1),
    roadnmbonbun character varying(5),
    roadnmbubun character varying(5),
    umdnm character varying(60),
    aptnm character varying(100),
    jibun character varying(20),
    excluusear numeric(10,4),
    dealyear integer,
    dealmonth integer,
    dealday integer,
    dealamount integer,
    floor integer,
    buildyear integer,
    aptseq character varying(20),
    cdealtype character varying(1),
    cdealday character varying(8),
    dealinggbn character varying(10),
    estateagentsggnm character varying(100),
    rgstdate character varying(8),
    aptdong character varying(400),
    slergbn character varying(100),
    buyergbn character varying(100),
    landleaseholdgbn character varying(1),
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    roadnmbcd character varying(1)
);


ALTER TABLE oi.old_apt_deal_trade_raw OWNER TO postgres;

--
-- Name: al_d002_11_20250804; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.al_d002_11_20250804 (
    gid integer NOT NULL,
    a0 integer,
    a1 character varying(19),
    a2 character varying(10),
    a3 character varying(254),
    a4 character varying(10),
    a5 character varying(200),
    a6 date,
    a7 character varying(5),
    geom public.geometry(MultiPolygon,5186)
);


ALTER TABLE public.al_d002_11_20250804 OWNER TO postgres;

--
-- Name: al_d002_11_20250804_gid_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.al_d002_11_20250804_gid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.al_d002_11_20250804_gid_seq OWNER TO postgres;

--
-- Name: al_d002_11_20250804_gid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.al_d002_11_20250804_gid_seq OWNED BY public.al_d002_11_20250804.gid;


--
-- Name: al_d154_11_20250830; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.al_d154_11_20250830 (
    gid integer NOT NULL,
    a0 character varying(19),
    a1 character varying(10),
    a2 character varying(254),
    a3 character varying(1),
    a4 character varying(20),
    a5 character varying(10),
    a6 character varying(200),
    a7 character varying(254),
    a8 character varying(254),
    a9 character varying(254),
    a10 character varying(254),
    a11 date,
    a12 character varying(5),
    geom public.geometry(MultiPolygon,5186)
);


ALTER TABLE public.al_d154_11_20250830 OWNER TO postgres;

--
-- Name: al_d154_11_20250830_gid_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.al_d154_11_20250830_gid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.al_d154_11_20250830_gid_seq OWNER TO postgres;

--
-- Name: al_d154_11_20250830_gid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.al_d154_11_20250830_gid_seq OWNED BY public.al_d154_11_20250830.gid;


--
-- Name: landuse_code; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.landuse_code (
    code character varying(10) NOT NULL,
    name character varying(200),
    description text
);


ALTER TABLE public.landuse_code OWNER TO postgres;

--
-- Name: v_landuse_included; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_landuse_included AS
 WITH src AS (
         SELECT t.gid,
            t.geom,
            string_to_array(replace((t.a7)::text, ' '::text, ''::text), ','::text) AS codes,
            string_to_array(replace((t.a9)::text, ' '::text, ''::text), ','::text) AS flags
           FROM public.al_d154_11_20250830 t
        ), pairs AS (
         SELECT s.gid,
            s.geom,
            s.codes[i.i] AS code,
            s.flags[i.i] AS flag,
            i.i
           FROM (src s
             CROSS JOIN LATERAL generate_subscripts(s.codes, 1) i(i))
        )
 SELECT pairs.gid,
    pairs.geom,
    pairs.code
   FROM pairs
  WHERE ((pairs.flag = '1'::text) AND (pairs.code IS NOT NULL));


ALTER TABLE public.v_landuse_included OWNER TO postgres;

--
-- Name: mv_landuse_included; Type: MATERIALIZED VIEW; Schema: public; Owner: postgres
--

CREATE MATERIALIZED VIEW public.mv_landuse_included AS
 SELECT v_landuse_included.gid,
    v_landuse_included.geom,
    v_landuse_included.code
   FROM public.v_landuse_included
  WITH NO DATA;


ALTER TABLE public.mv_landuse_included OWNER TO postgres;

--
-- Name: v_landuse_included_agg; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_landuse_included_agg AS
 WITH src AS (
         SELECT t.gid,
            t.geom,
            string_to_array(regexp_replace((t.a7)::text, '\s+'::text, ''::text, 'g'::text), ','::text) AS codes,
            string_to_array(regexp_replace((t.a9)::text, '\s+'::text, ''::text, 'g'::text), ','::text) AS flags
           FROM public.al_d154_11_20250830 t
        ), pairs AS (
         SELECT s_1.gid,
            s_1.geom,
            g.idx,
            s_1.codes[g.idx] AS code,
            s_1.flags[g.idx] AS flag
           FROM (src s_1
             CROSS JOIN LATERAL generate_series(1, GREATEST(0, LEAST(COALESCE(array_length(s_1.codes, 1), 0), COALESCE(array_length(s_1.flags, 1), 0)))) g(idx))
        ), only1 AS (
         SELECT pairs.gid,
            pairs.geom,
            pairs.idx,
            pairs.code
           FROM pairs
          WHERE ((pairs.flag = '1'::text) AND (pairs.code IS NOT NULL) AND (pairs.code <> ''::text))
        ), dedup AS (
         SELECT only1.gid,
            only1.geom,
            min(only1.idx) AS first_idx,
            only1.code
           FROM only1
          GROUP BY only1.gid, only1.geom, only1.code
        )
 SELECT s.gid,
    s.geom,
    COALESCE(string_agg(d.code, ','::text ORDER BY d.first_idx), ''::text) AS code
   FROM (src s
     LEFT JOIN dedup d ON (((d.gid = s.gid) AND (d.geom OPERATOR(public.=) s.geom))))
  GROUP BY s.gid, s.geom;


ALTER TABLE public.v_landuse_included_agg OWNER TO postgres;

--
-- Name: mv_landuse_included_agg; Type: MATERIALIZED VIEW; Schema: public; Owner: postgres
--

CREATE MATERIALIZED VIEW public.mv_landuse_included_agg AS
 SELECT v_landuse_included_agg.gid,
    v_landuse_included_agg.geom,
    v_landuse_included_agg.code
   FROM public.v_landuse_included_agg
  WITH NO DATA;


ALTER TABLE public.mv_landuse_included_agg OWNER TO postgres;

--
-- Name: seoul_bldg; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.seoul_bldg (
    gid integer NOT NULL,
    eqb_man_sn double precision,
    opert_de character varying(14),
    sig_cd character varying(5),
    geom public.geometry(MultiPolygon)
);


ALTER TABLE public.seoul_bldg OWNER TO postgres;

--
-- Name: seoul_bldg_gid_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.seoul_bldg_gid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.seoul_bldg_gid_seq OWNER TO postgres;

--
-- Name: seoul_bldg_gid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.seoul_bldg_gid_seq OWNED BY public.seoul_bldg.gid;


--
-- Name: tl_spbd_eqb_11_202508; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tl_spbd_eqb_11_202508 (
    gid integer NOT NULL,
    eqb_man_sn double precision,
    opert_de character varying(14),
    sig_cd character varying(5),
    geom public.geometry(MultiPolygon)
);


ALTER TABLE public.tl_spbd_eqb_11_202508 OWNER TO postgres;

--
-- Name: tl_spbd_eqb_11_202508_gid_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tl_spbd_eqb_11_202508_gid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.tl_spbd_eqb_11_202508_gid_seq OWNER TO postgres;

--
-- Name: tl_spbd_eqb_11_202508_gid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tl_spbd_eqb_11_202508_gid_seq OWNED BY public.tl_spbd_eqb_11_202508.gid;


--
-- Name: apt_building_info id; Type: DEFAULT; Schema: oi; Owner: postgres
--

ALTER TABLE ONLY oi.apt_building_info ALTER COLUMN id SET DEFAULT nextval('oi.apt_building_info_id_seq'::regclass);


--
-- Name: apt_deal_all id; Type: DEFAULT; Schema: oi; Owner: postgres
--

ALTER TABLE ONLY oi.apt_deal_all ALTER COLUMN id SET DEFAULT nextval('oi.apt_deal_all_id_seq'::regclass);


--
-- Name: apt_deal_rent_raw id; Type: DEFAULT; Schema: oi; Owner: postgres
--

ALTER TABLE ONLY oi.apt_deal_rent_raw ALTER COLUMN id SET DEFAULT nextval('oi.apt_deal_rent_raw_id_seq'::regclass);


--
-- Name: apt_deal_trade_raw id; Type: DEFAULT; Schema: oi; Owner: postgres
--

ALTER TABLE ONLY oi.apt_deal_trade_raw ALTER COLUMN id SET DEFAULT nextval('oi.apt_deal_trade_raw_id_seq'::regclass);


--
-- Name: apt_info id; Type: DEFAULT; Schema: oi; Owner: postgres
--

ALTER TABLE ONLY oi.apt_info ALTER COLUMN id SET DEFAULT nextval('oi.apt_info_id_seq'::regclass);


--
-- Name: al_d002_11_20250804 gid; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.al_d002_11_20250804 ALTER COLUMN gid SET DEFAULT nextval('public.al_d002_11_20250804_gid_seq'::regclass);


--
-- Name: al_d154_11_20250830 gid; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.al_d154_11_20250830 ALTER COLUMN gid SET DEFAULT nextval('public.al_d154_11_20250830_gid_seq'::regclass);


--
-- Name: seoul_bldg gid; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seoul_bldg ALTER COLUMN gid SET DEFAULT nextval('public.seoul_bldg_gid_seq'::regclass);


--
-- Name: tl_spbd_eqb_11_202508 gid; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tl_spbd_eqb_11_202508 ALTER COLUMN gid SET DEFAULT nextval('public.tl_spbd_eqb_11_202508_gid_seq'::regclass);


--
-- Name: ai_smart_summary ai_smart_summary_pkey; Type: CONSTRAINT; Schema: oi; Owner: postgres
--

ALTER TABLE ONLY oi.ai_smart_summary
    ADD CONSTRAINT ai_smart_summary_pkey PRIMARY KEY (apt_id);


--
-- Name: apt_building_info apt_building_info_pkey; Type: CONSTRAINT; Schema: oi; Owner: postgres
--

ALTER TABLE ONLY oi.apt_building_info
    ADD CONSTRAINT apt_building_info_pkey PRIMARY KEY (id);


--
-- Name: apt_deal_all apt_deal_all_pkey; Type: CONSTRAINT; Schema: oi; Owner: postgres
--

ALTER TABLE ONLY oi.apt_deal_all
    ADD CONSTRAINT apt_deal_all_pkey PRIMARY KEY (id);


--
-- Name: apt_deal_rent_raw apt_deal_rent_raw_pkey; Type: CONSTRAINT; Schema: oi; Owner: postgres
--

ALTER TABLE ONLY oi.apt_deal_rent_raw
    ADD CONSTRAINT apt_deal_rent_raw_pkey PRIMARY KEY (id);


--
-- Name: apt_deal_trade_raw apt_deal_trade_raw_pkey; Type: CONSTRAINT; Schema: oi; Owner: postgres
--

ALTER TABLE ONLY oi.apt_deal_trade_raw
    ADD CONSTRAINT apt_deal_trade_raw_pkey PRIMARY KEY (id);


--
-- Name: apt_info apt_info_pkey; Type: CONSTRAINT; Schema: oi; Owner: postgres
--

ALTER TABLE ONLY oi.apt_info
    ADD CONSTRAINT apt_info_pkey PRIMARY KEY (id);


--
-- Name: legal_dong legal_dong_pkey; Type: CONSTRAINT; Schema: oi; Owner: postgres
--

ALTER TABLE ONLY oi.legal_dong
    ADD CONSTRAINT legal_dong_pkey PRIMARY KEY (code);


--
-- Name: al_d002_11_20250804 al_d002_11_20250804_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.al_d002_11_20250804
    ADD CONSTRAINT al_d002_11_20250804_pkey PRIMARY KEY (gid);


--
-- Name: al_d154_11_20250830 al_d154_11_20250830_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.al_d154_11_20250830
    ADD CONSTRAINT al_d154_11_20250830_pkey PRIMARY KEY (gid);


--
-- Name: landuse_code landuse_code_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.landuse_code
    ADD CONSTRAINT landuse_code_pkey PRIMARY KEY (code);


--
-- Name: seoul_bldg seoul_bldg_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seoul_bldg
    ADD CONSTRAINT seoul_bldg_pkey PRIMARY KEY (gid);


--
-- Name: tl_spbd_eqb_11_202508 tl_spbd_eqb_11_202508_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tl_spbd_eqb_11_202508
    ADD CONSTRAINT tl_spbd_eqb_11_202508_pkey PRIMARY KEY (gid);


--
-- Name: idx_ai_summary_created_at; Type: INDEX; Schema: oi; Owner: postgres
--

CREATE INDEX idx_ai_summary_created_at ON oi.ai_smart_summary USING btree (created_at);


--
-- Name: idx_ai_summary_user_id; Type: INDEX; Schema: oi; Owner: postgres
--

CREATE INDEX idx_ai_summary_user_id ON oi.ai_smart_summary USING btree (user_id);


--
-- Name: al_d002_11_20250804_geom_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX al_d002_11_20250804_geom_idx ON public.al_d002_11_20250804 USING gist (geom);


--
-- Name: al_d154_11_20250830_geom_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX al_d154_11_20250830_geom_idx ON public.al_d154_11_20250830 USING gist (geom);


--
-- Name: mv_landuse_included_agg_gix; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX mv_landuse_included_agg_gix ON public.mv_landuse_included_agg USING gist (geom);


--
-- Name: mv_landuse_included_code_ix; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX mv_landuse_included_code_ix ON public.mv_landuse_included USING btree (code);


--
-- Name: mv_landuse_included_gix; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX mv_landuse_included_gix ON public.mv_landuse_included USING gist (geom);


--
-- Name: seoul_bldg_geom_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX seoul_bldg_geom_idx ON public.seoul_bldg USING gist (geom);


--
-- Name: tl_spbd_eqb_11_202508_geom_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tl_spbd_eqb_11_202508_geom_idx ON public.tl_spbd_eqb_11_202508 USING gist (geom);


--
-- Name: ai_smart_summary update_ai_smart_summary_updated_at; Type: TRIGGER; Schema: oi; Owner: postgres
--

CREATE TRIGGER update_ai_smart_summary_updated_at BEFORE UPDATE ON oi.ai_smart_summary FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ai_smart_summary ai_smart_summary_apt_id_fkey; Type: FK CONSTRAINT; Schema: oi; Owner: postgres
--

ALTER TABLE ONLY oi.ai_smart_summary
    ADD CONSTRAINT ai_smart_summary_apt_id_fkey FOREIGN KEY (apt_id) REFERENCES oi.apt_info(id) ON DELETE CASCADE;


--
-- Name: apt_building_info apt_building_info_apt_id_fkey; Type: FK CONSTRAINT; Schema: oi; Owner: postgres
--

ALTER TABLE ONLY oi.apt_building_info
    ADD CONSTRAINT apt_building_info_apt_id_fkey FOREIGN KEY (apt_id) REFERENCES oi.apt_info(id);


--
-- Name: SCHEMA oi; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA oi TO cc_readonly;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO cc_readonly;


--
-- Name: TABLE ai_smart_summary; Type: ACL; Schema: oi; Owner: postgres
--

GRANT SELECT ON TABLE oi.ai_smart_summary TO cc_readonly;


--
-- Name: TABLE apt_building_info; Type: ACL; Schema: oi; Owner: postgres
--

GRANT SELECT ON TABLE oi.apt_building_info TO cc_readonly;


--
-- Name: SEQUENCE apt_building_info_id_seq; Type: ACL; Schema: oi; Owner: postgres
--

GRANT SELECT ON SEQUENCE oi.apt_building_info_id_seq TO cc_readonly;


--
-- Name: TABLE apt_deal_all; Type: ACL; Schema: oi; Owner: postgres
--

GRANT SELECT ON TABLE oi.apt_deal_all TO cc_readonly;


--
-- Name: SEQUENCE apt_deal_all_id_seq; Type: ACL; Schema: oi; Owner: postgres
--

GRANT SELECT ON SEQUENCE oi.apt_deal_all_id_seq TO cc_readonly;


--
-- Name: TABLE apt_deal_rent_raw; Type: ACL; Schema: oi; Owner: postgres
--

GRANT SELECT ON TABLE oi.apt_deal_rent_raw TO cc_readonly;


--
-- Name: SEQUENCE apt_deal_rent_raw_id_seq; Type: ACL; Schema: oi; Owner: postgres
--

GRANT SELECT ON SEQUENCE oi.apt_deal_rent_raw_id_seq TO cc_readonly;


--
-- Name: TABLE apt_deal_trade_raw; Type: ACL; Schema: oi; Owner: postgres
--

GRANT SELECT ON TABLE oi.apt_deal_trade_raw TO cc_readonly;


--
-- Name: SEQUENCE apt_deal_trade_raw_id_seq; Type: ACL; Schema: oi; Owner: postgres
--

GRANT SELECT ON SEQUENCE oi.apt_deal_trade_raw_id_seq TO cc_readonly;


--
-- Name: TABLE apt_info; Type: ACL; Schema: oi; Owner: postgres
--

GRANT SELECT ON TABLE oi.apt_info TO cc_readonly;


--
-- Name: SEQUENCE apt_info_id_seq; Type: ACL; Schema: oi; Owner: postgres
--

GRANT SELECT ON SEQUENCE oi.apt_info_id_seq TO cc_readonly;


--
-- Name: TABLE landuse_included; Type: ACL; Schema: oi; Owner: postgres
--

GRANT SELECT ON TABLE oi.landuse_included TO cc_readonly;


--
-- Name: TABLE legal_dong; Type: ACL; Schema: oi; Owner: postgres
--

GRANT SELECT ON TABLE oi.legal_dong TO cc_readonly;


--
-- Name: TABLE old_apt_deal_all; Type: ACL; Schema: oi; Owner: postgres
--

GRANT SELECT ON TABLE oi.old_apt_deal_all TO cc_readonly;


--
-- Name: TABLE old_apt_deal_rent_raw; Type: ACL; Schema: oi; Owner: postgres
--

GRANT SELECT ON TABLE oi.old_apt_deal_rent_raw TO cc_readonly;


--
-- Name: TABLE old_apt_deal_trade_raw; Type: ACL; Schema: oi; Owner: postgres
--

GRANT SELECT ON TABLE oi.old_apt_deal_trade_raw TO cc_readonly;


--
-- Name: TABLE al_d002_11_20250804; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.al_d002_11_20250804 TO cc_readonly;


--
-- Name: SEQUENCE al_d002_11_20250804_gid_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON SEQUENCE public.al_d002_11_20250804_gid_seq TO cc_readonly;


--
-- Name: TABLE al_d154_11_20250830; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.al_d154_11_20250830 TO cc_readonly;


--
-- Name: SEQUENCE al_d154_11_20250830_gid_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON SEQUENCE public.al_d154_11_20250830_gid_seq TO cc_readonly;


--
-- Name: TABLE landuse_code; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.landuse_code TO cc_readonly;


--
-- Name: TABLE v_landuse_included; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.v_landuse_included TO cc_readonly;


--
-- Name: TABLE mv_landuse_included; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.mv_landuse_included TO cc_readonly;


--
-- Name: TABLE v_landuse_included_agg; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.v_landuse_included_agg TO cc_readonly;


--
-- Name: TABLE mv_landuse_included_agg; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.mv_landuse_included_agg TO cc_readonly;


--
-- Name: TABLE seoul_bldg; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.seoul_bldg TO cc_readonly;


--
-- Name: SEQUENCE seoul_bldg_gid_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON SEQUENCE public.seoul_bldg_gid_seq TO cc_readonly;


--
-- Name: TABLE tl_spbd_eqb_11_202508; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.tl_spbd_eqb_11_202508 TO cc_readonly;


--
-- Name: SEQUENCE tl_spbd_eqb_11_202508_gid_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON SEQUENCE public.tl_spbd_eqb_11_202508_gid_seq TO cc_readonly;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: oi; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA oi GRANT SELECT ON SEQUENCES  TO cc_readonly;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: oi; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA oi GRANT SELECT ON TABLES  TO cc_readonly;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT ON SEQUENCES  TO cc_readonly;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT ON TABLES  TO cc_readonly;


--
-- PostgreSQL database dump complete
--

