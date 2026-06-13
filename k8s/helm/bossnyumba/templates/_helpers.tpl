{{/*
Common labels — every workload template includes these.
*/}}
{{- define "bossnyumba.labels" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
{{- end -}}

{{/*
Selector labels — must remain stable across upgrades (label selectors
are immutable on Deployments / Services post-creation).
*/}}
{{- define "bossnyumba.selectorLabels" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{/*
Image reference for a workload. Call as:
  {{ include "bossnyumba.image" (dict "Values" .Values "workload" .Values.apps.ownerPortal) }}
Resolves per-workload tag fallback to .Values.image.tag.
*/}}
{{- define "bossnyumba.image" -}}
{{- $w := .workload -}}
{{- $v := .Values -}}
{{- $tag := default $v.image.tag $w.image.tag -}}
{{- printf "%s/%s/%s:%s" $v.image.registry $v.image.project $w.image.repository $tag -}}
{{- end -}}

{{/*
Pod security context — applied at the pod level on every workload.
*/}}
{{- define "bossnyumba.podSecurityContext" -}}
runAsNonRoot: {{ .Values.podSecurity.runAsNonRoot }}
runAsUser: {{ .Values.podSecurity.runAsUser }}
runAsGroup: {{ .Values.podSecurity.runAsUser }}
fsGroup: {{ .Values.podSecurity.runAsUser }}
seccompProfile:
  type: {{ .Values.podSecurity.seccompProfile }}
{{- end -}}

{{/*
Container security context — applied to every container in every
workload.
*/}}
{{- define "bossnyumba.containerSecurityContext" -}}
allowPrivilegeEscalation: false
readOnlyRootFilesystem: {{ .Values.podSecurity.readOnlyRootFilesystem }}
runAsNonRoot: {{ .Values.podSecurity.runAsNonRoot }}
runAsUser: {{ .Values.podSecurity.runAsUser }}
capabilities:
  drop: [ALL]
seccompProfile:
  type: {{ .Values.podSecurity.seccompProfile }}
{{- end -}}

{{/*
Standard pod annotations — Linkerd inject, config checksum.
*/}}
{{- define "bossnyumba.podAnnotations" -}}
{{- if .Values.linkerd.enabled }}
linkerd.io/inject: {{ .Values.linkerd.inject }}
config.linkerd.io/proxy-cpu-request: "100m"
config.linkerd.io/proxy-memory-request: "32Mi"
{{- end }}
{{- end -}}
