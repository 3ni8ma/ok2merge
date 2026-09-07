Pod::Spec.new do |s|
  s.name = 'WidgetBridge'
  s.version = '1.0.0'
  s.summary = 'OK2Merge widget snapshot bridge'
  s.license = 'MIT'
  s.homepage = 'https://ok2merge.app'
  s.author = 'OK2Merge'
  s.source = { :git => 'https://ok2merge.app/widget-bridge.git', :tag => s.version.to_s }
  s.platform = :ios, '15.0'
  s.swift_version = '5.9'
  s.source_files = 'ios/**/*.{swift,h,m}'
  s.dependency 'Capacitor'
end
