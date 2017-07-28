CREATE TABLE views (
  id        uuid PRIMARY KEY,
  t         timestamp without time zone NOT NULL,
  url       text NOT NULL
);
CREATE INDEX views__t ON views (t);
CREATE INDEX views__url__t ON views (url, t);


CREATE TABLE requests (
  id            uuid PRIMARY KEY,
  view_id       uuid REFERENCES views(id) NOT NULL,
  url           text NOT NULL,
  hostname      text NOT NULL,
  pathname      text NOT NULL,
  status        smallint,
  mime          text,
  size          integer
);
CREATE INDEX requests__view_id ON requests (view_id);
CREATE INDEX requests__mime__size ON requests (mime, size);
