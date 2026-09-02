# SPDX-License-Identifier: AGPL-3.0-only
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$OutputDirectory,
  [switch]$Expired
)

$ErrorActionPreference = 'Stop'
if ($env:NODE_ENV -ne 'test' -or $env:TANCMARK_C2PA_ALLOW_TEST_SIGNING -ne '1' -or $env:AEGIS_PRODUCT_RUNTIME -eq '1') {
  throw 'c2pa_test_signing_not_allowed'
}

$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
$directory = Get-Item -LiteralPath $resolvedOutput -Force
if (-not $directory.PSIsContainer -or ($directory.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
  throw 'c2pa_test_output_directory_invalid'
}

$certificatePath = [System.IO.Path]::Combine($resolvedOutput, 'cert.pem')
$privateKeyPath = [System.IO.Path]::Combine($resolvedOutput, 'key.pem')
if ([System.IO.File]::Exists($certificatePath) -or [System.IO.File]::Exists($privateKeyPath)) {
  throw 'c2pa_test_material_already_exists'
}

$rootKey = [System.Security.Cryptography.ECDsa]::Create([System.Security.Cryptography.ECCurve+NamedCurves]::nistP256)
$leafKey = [System.Security.Cryptography.ECDsa]::Create([System.Security.Cryptography.ECCurve+NamedCurves]::nistP256)
$rootCertificate = $null
$leafCertificate = $null
$certificateBytes = $null
$rootCertificateBytes = $null
$privateKeyBytes = $null
try {
  $rootRequest = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new(
    'CN=TancMark Ephemeral C2PA Test Root,O=TancMark Research',
    $rootKey,
    [System.Security.Cryptography.HashAlgorithmName]::SHA256
  )
  $rootRequest.CertificateExtensions.Add(
    [System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($true, $true, 0, $true)
  )
  $rootRequest.CertificateExtensions.Add(
    [System.Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new(
      [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::KeyCertSign -bor
      [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::CrlSign,
      $true
    )
  )
  $rootRequest.CertificateExtensions.Add(
    [System.Security.Cryptography.X509Certificates.X509SubjectKeyIdentifierExtension]::new($rootRequest.PublicKey, $false)
  )
  $rootCertificate = $rootRequest.CreateSelfSigned(
    [System.DateTimeOffset]::UtcNow.AddDays(-3),
    [System.DateTimeOffset]::UtcNow.AddDays(3)
  )

  $request = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new(
    'CN=TancMark Ephemeral C2PA Test Signer,O=TancMark Research',
    $leafKey,
    [System.Security.Cryptography.HashAlgorithmName]::SHA256
  )
  $request.CertificateExtensions.Add(
    [System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($false, $false, 0, $true)
  )
  $request.CertificateExtensions.Add(
    [System.Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new(
      [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DigitalSignature,
      $true
    )
  )
  $oids = [System.Security.Cryptography.OidCollection]::new()
  [void]$oids.Add([System.Security.Cryptography.Oid]::new('1.3.6.1.5.5.7.3.4', 'Email Protection'))
  [void]$oids.Add([System.Security.Cryptography.Oid]::new('1.3.6.1.5.5.7.3.36', 'Document Signing'))
  $request.CertificateExtensions.Add(
    [System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($oids, $true)
  )
  $request.CertificateExtensions.Add(
    [System.Security.Cryptography.X509Certificates.X509SubjectKeyIdentifierExtension]::new($request.PublicKey, $false)
  )
  $request.CertificateExtensions.Add(
    [System.Security.Cryptography.X509Certificates.X509AuthorityKeyIdentifierExtension]::CreateFromCertificate(
      $rootCertificate,
      $true,
      $false
    )
  )

  if ($Expired) {
    $notBefore = [System.DateTimeOffset]::UtcNow.AddDays(-2)
    $notAfter = [System.DateTimeOffset]::UtcNow.AddDays(-1)
  } else {
    $notBefore = [System.DateTimeOffset]::UtcNow.AddMinutes(-5)
    $notAfter = [System.DateTimeOffset]::UtcNow.AddHours(2)
  }
  $serial = [System.Security.Cryptography.RandomNumberGenerator]::GetBytes(16)
  $serial[0] = $serial[0] -band 0x7F
  $leafCertificate = $request.Create($rootCertificate, $notBefore, $notAfter, $serial)
  $certificateBytes = $leafCertificate.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
  $rootCertificateBytes = $rootCertificate.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
  $privateKeyBytes = $leafKey.ExportPkcs8PrivateKey()
  $certificatePem = [System.Security.Cryptography.PemEncoding]::WriteString('CERTIFICATE', $certificateBytes) + "`n" +
    [System.Security.Cryptography.PemEncoding]::WriteString('CERTIFICATE', $rootCertificateBytes) + "`n"
  $privateKeyPem = [System.Security.Cryptography.PemEncoding]::WriteString('PRIVATE KEY', $privateKeyBytes)

  $certificateStream = [System.IO.File]::Open($certificatePath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
  try {
    $certificateText = [System.Text.UTF8Encoding]::new($false).GetBytes($certificatePem)
    $certificateStream.Write($certificateText, 0, $certificateText.Length)
    $certificateStream.Flush($true)
  } finally {
    $certificateStream.Dispose()
  }
  $privateKeyStream = [System.IO.File]::Open($privateKeyPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
  try {
    $privateKeyText = [System.Text.UTF8Encoding]::new($false).GetBytes($privateKeyPem)
    $privateKeyStream.Write($privateKeyText, 0, $privateKeyText.Length)
    $privateKeyStream.Flush($true)
  } finally {
    $privateKeyStream.Dispose()
  }

  [Console]::Out.WriteLine('{"ok":true,"algorithm":"es256","testOnly":true,"officiallyTrusted":false}')
} finally {
  if ($null -ne $certificateBytes) { [System.Array]::Clear($certificateBytes, 0, $certificateBytes.Length) }
  if ($null -ne $rootCertificateBytes) { [System.Array]::Clear($rootCertificateBytes, 0, $rootCertificateBytes.Length) }
  if ($null -ne $privateKeyBytes) { [System.Array]::Clear($privateKeyBytes, 0, $privateKeyBytes.Length) }
  if ($null -ne $leafCertificate) { $leafCertificate.Dispose() }
  if ($null -ne $rootCertificate) { $rootCertificate.Dispose() }
  if ($null -ne $leafKey) { $leafKey.Dispose() }
  if ($null -ne $rootKey) { $rootKey.Dispose() }
}
