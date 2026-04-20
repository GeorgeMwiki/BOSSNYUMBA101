{{/*
Expand the name of the chart.
*/}}
{{- define "bossnyumba.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Fully qualified app name.
*/}}
{{- define "bossnyumba.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{/*
Chart label.
*/}}
{{- define "bossnyumba.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Common labels.
*/}}
{{- define "bossnyumba.labels" -}}
helm.sh/chart: {{ include "bossnyumba.chart" . }}
{{ include "bossnyumba.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{/*
Selector labels.
*/}}
{{- define "bossnyumba.selectorLabels" -}}
app.kubernetes.io/name: {{ include "bossnyumba.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{/*
Per-component image tag resolution.
*/}}
{{- define "bossnyumba.image" -}}
{{- $root := index . 0 -}}
{{- $component := index . 1 -}}
{{- $tag := default $root.Values.image.tag $component.tag -}}
{{- printf "%s/%s/%s:%s" $root.Values.image.registry $root.Values.image.repository $component.name $tag -}}
{{- end -}}
