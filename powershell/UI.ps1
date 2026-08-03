# Modern WPF interface for Daily Task Reminder.
# Dot-sourced by DailyTaskReminder.ps1.

Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

$script:UiTheme = @{
    Background   = '#FF12151C'
    Card         = '#FF1A1F2A'
    CardHover    = '#FF222836'
    Border       = '#FF2A3140'
    Text         = '#FFEDF1F8'
    Muted        = '#FF95A1B6'
    Accent       = '#FF4F8CFF'
    AccentHover  = '#FF6C9EFF'
    High         = '#FFFF6B6B'
    Medium       = '#FFFFB020'
    Low          = '#FF3DD68C'
}

function Get-PriorityColor {
    param([string]$Priority)
    switch ($Priority) {
        'High' { return $script:UiTheme.High }
        'Medium' { return $script:UiTheme.Medium }
        default { return $script:UiTheme.Low }
    }
}

function Get-OptionalProperty {
    param($Object, [string]$Name)
    if (-not $Object) { return $null }
    $property = $Object.PSObject.Properties[$Name]
    if ($property) { return $property.Value }
    return $null
}

function Get-SharedResourceXaml {
    return @'
  <Window.Resources>
    <SolidColorBrush x:Key="Bg" Color="#12151C"/>
    <SolidColorBrush x:Key="Card" Color="#1A1F2A"/>
    <SolidColorBrush x:Key="CardHover" Color="#222836"/>
    <SolidColorBrush x:Key="BorderBrushSoft" Color="#2A3140"/>
    <SolidColorBrush x:Key="Fg" Color="#EDF1F8"/>
    <SolidColorBrush x:Key="Muted" Color="#95A1B6"/>
    <SolidColorBrush x:Key="Accent" Color="#4F8CFF"/>

    <Style TargetType="TextBlock">
      <Setter Property="FontFamily" Value="Segoe UI Variable Display, Segoe UI"/>
      <Setter Property="Foreground" Value="{StaticResource Fg}"/>
      <Setter Property="TextOptions.TextFormattingMode" Value="Ideal"/>
    </Style>

    <Style x:Key="Chip" TargetType="Border">
      <Setter Property="CornerRadius" Value="999"/>
      <Setter Property="Padding" Value="10,3"/>
      <Setter Property="Background" Value="#20FFFFFF"/>
      <Setter Property="Margin" Value="0,0,8,0"/>
    </Style>

    <Style x:Key="BaseButton" TargetType="Button">
      <Setter Property="FontFamily" Value="Segoe UI Variable Text, Segoe UI"/>
      <Setter Property="FontSize" Value="13"/>
      <Setter Property="FontWeight" Value="SemiBold"/>
      <Setter Property="Foreground" Value="{StaticResource Fg}"/>
      <Setter Property="Background" Value="#00FFFFFF"/>
      <Setter Property="BorderThickness" Value="1"/>
      <Setter Property="BorderBrush" Value="{StaticResource BorderBrushSoft}"/>
      <Setter Property="Padding" Value="16,9"/>
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="SnapsToDevicePixels" Value="True"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="Button">
            <Border x:Name="Chrome" CornerRadius="8"
                    Background="{TemplateBinding Background}"
                    BorderBrush="{TemplateBinding BorderBrush}"
                    BorderThickness="{TemplateBinding BorderThickness}">
              <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"
                                Margin="{TemplateBinding Padding}"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True">
                <Setter TargetName="Chrome" Property="Background" Value="#1AFFFFFF"/>
              </Trigger>
              <Trigger Property="IsEnabled" Value="False">
                <Setter Property="Opacity" Value="0.45"/>
              </Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>

    <Style x:Key="PrimaryButton" TargetType="Button" BasedOn="{StaticResource BaseButton}">
      <Setter Property="Background" Value="{StaticResource Accent}"/>
      <Setter Property="BorderBrush" Value="{StaticResource Accent}"/>
      <Setter Property="Foreground" Value="White"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="Button">
            <Border x:Name="Chrome" CornerRadius="8" Background="{TemplateBinding Background}">
              <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"
                                Margin="{TemplateBinding Padding}"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True">
                <Setter TargetName="Chrome" Property="Background" Value="#6C9EFF"/>
              </Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>

    <Style TargetType="TextBox">
      <Setter Property="FontFamily" Value="Segoe UI Variable Text, Segoe UI"/>
      <Setter Property="FontSize" Value="13"/>
      <Setter Property="Foreground" Value="{StaticResource Fg}"/>
      <Setter Property="CaretBrush" Value="{StaticResource Fg}"/>
      <Setter Property="Background" Value="#12161F"/>
      <Setter Property="BorderBrush" Value="{StaticResource BorderBrushSoft}"/>
      <Setter Property="BorderThickness" Value="1"/>
      <Setter Property="Padding" Value="10,8"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="TextBox">
            <Border CornerRadius="8" Background="{TemplateBinding Background}"
                    BorderBrush="{TemplateBinding BorderBrush}"
                    BorderThickness="{TemplateBinding BorderThickness}">
              <ScrollViewer x:Name="PART_ContentHost" Margin="{TemplateBinding Padding}"/>
            </Border>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>

    <Style TargetType="ComboBox">
      <Setter Property="FontFamily" Value="Segoe UI Variable Text, Segoe UI"/>
      <Setter Property="FontSize" Value="13"/>
      <Setter Property="Padding" Value="8,6"/>
    </Style>

    <Style TargetType="ScrollBar">
      <Setter Property="Width" Value="8"/>
      <Setter Property="Background" Value="Transparent"/>
    </Style>
  </Window.Resources>
'@
}

function ConvertTo-WpfWindow {
    param([Parameter(Mandatory)][string]$Xaml)
    $reader = New-Object System.Xml.XmlNodeReader ([xml]$Xaml)
    return [Windows.Markup.XamlReader]::Load($reader)
}

function Set-WindowBottomRight {
    param($Window, [int]$Margin = 24)
    $area = [System.Windows.SystemParameters]::WorkArea
    $Window.Left = $area.Right - $Window.Width - $Margin
    $Window.Top = $area.Bottom - $Window.ActualHeight - $Margin
}

function Add-DragHandler {
    param($Window, $Element)
    $Element.Add_MouseLeftButtonDown({
        param($sender, $e)
        if ($e.ButtonState -eq 'Pressed') { $Window.DragMove() }
    }.GetNewClosure())
}

<#
.SYNOPSIS
Slide-in reminder card. Returns Done, InProgress, Snooze5, Snooze15, Snooze60, or Dismiss.
#>
function Show-ReminderWindow {
    param(
        [Parameter(Mandatory)]$Task,
        [int]$Remaining,
        [int]$Total,
        [int]$Completed
    )

    $accent = (Get-PriorityColor $Task.Priority).Substring(3)
    $source = if ($Task.AdoWorkItemId) { "ADO #$($Task.AdoWorkItemId)" } else { 'Personal TODO' }
    $progress = if ($Total -gt 0) { [math]::Round(($Completed / $Total) * 100) } else { 0 }
    $title = [System.Security.SecurityElement]::Escape($Task.Title)

    $xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Task reminder" Width="420" SizeToContent="Height"
        WindowStyle="None" AllowsTransparency="True" Background="Transparent"
        ShowInTaskbar="False" Topmost="True" ResizeMode="NoResize">
$(Get-SharedResourceXaml)
  <Border Margin="18" CornerRadius="14" Background="{StaticResource Card}"
          BorderBrush="{StaticResource BorderBrushSoft}" BorderThickness="1">
    <Border.Effect>
      <DropShadowEffect BlurRadius="28" ShadowDepth="6" Opacity="0.55" Color="#000000"/>
    </Border.Effect>
    <Grid>
      <Grid.RowDefinitions>
        <RowDefinition Height="Auto"/>
        <RowDefinition Height="Auto"/>
        <RowDefinition Height="Auto"/>
      </Grid.RowDefinitions>

      <Border x:Name="Header" Grid.Row="0" CornerRadius="14,14,0,0" Padding="18,14,14,10">
        <Grid>
          <StackPanel Orientation="Horizontal">
            <Border Width="8" Height="8" CornerRadius="4" Background="#$accent" VerticalAlignment="Center"/>
            <TextBlock Text="TASK REMINDER" Margin="10,0,0,0" FontSize="11" FontWeight="Bold"
                       Foreground="{StaticResource Muted}"/>
          </StackPanel>
          <Button x:Name="BtnClose" Style="{StaticResource BaseButton}" Content="&#x2715;"
                  HorizontalAlignment="Right" Padding="8,2" BorderThickness="0"
                  Foreground="{StaticResource Muted}" FontSize="12"/>
        </Grid>
      </Border>

      <StackPanel Grid.Row="1" Margin="18,0,18,4">
        <TextBlock Text="$title" FontSize="19" FontWeight="SemiBold" TextWrapping="Wrap" LineHeight="26"/>
        <StackPanel Orientation="Horizontal" Margin="0,12,0,0">
          <Border Style="{StaticResource Chip}" Background="#26$accent">
            <TextBlock Text="$($Task.Priority)" FontSize="11" FontWeight="SemiBold" Foreground="#$accent"/>
          </Border>
          <Border Style="{StaticResource Chip}">
            <TextBlock Text="&#x1F551; $($Task.ScheduleTime)" FontSize="11" Foreground="{StaticResource Muted}"/>
          </Border>
          <Border Style="{StaticResource Chip}">
            <TextBlock Text="$source" FontSize="11" Foreground="{StaticResource Muted}"/>
          </Border>
        </StackPanel>

        <Grid Margin="0,16,0,0">
          <Border Height="6" CornerRadius="3" Background="#16FFFFFF"/>
          <Border Height="6" CornerRadius="3" Background="#$accent"
                  HorizontalAlignment="Left" Width="$([math]::Max(6, 3.6 * $progress))"/>
        </Grid>
        <TextBlock Margin="0,8,0,0" FontSize="12" Foreground="{StaticResource Muted}"
                   Text="$Completed of $Total done  &#183;  $Remaining remaining today"/>
      </StackPanel>

      <Grid Grid.Row="2" Margin="18,18,18,18">
        <Grid.ColumnDefinitions>
          <ColumnDefinition Width="*"/>
          <ColumnDefinition Width="Auto"/>
          <ColumnDefinition Width="Auto"/>
        </Grid.ColumnDefinitions>
        <StackPanel Grid.Column="0" Orientation="Horizontal">
          <Button x:Name="BtnOpenAdo" Style="{StaticResource BaseButton}"
                  Content="Open in ADO &#x2197;" Margin="0,0,8,0"/>
          <Button x:Name="BtnSnooze" Style="{StaticResource BaseButton}"
                  Content="Snooze &#x25BE;">
            <Button.ContextMenu>
              <ContextMenu x:Name="SnoozeMenu">
                <MenuItem x:Name="Snooze5" Header="5 minutes"/>
                <MenuItem x:Name="Snooze15" Header="15 minutes"/>
                <MenuItem x:Name="Snooze60" Header="1 hour"/>
              </ContextMenu>
            </Button.ContextMenu>
          </Button>
        </StackPanel>
        <Button x:Name="BtnProgress" Grid.Column="1" Style="{StaticResource BaseButton}"
                Content="In progress" Margin="0,0,8,0"/>
        <Button x:Name="BtnDone" Grid.Column="2" Style="{StaticResource PrimaryButton}"
                Content="&#x2713;  Mark done"/>
      </Grid>
    </Grid>
  </Border>
</Window>
"@

    $window = ConvertTo-WpfWindow $xaml
    $script:ReminderResult = 'Dismiss'

    $close = { param($r) $script:ReminderResult = $r; $window.Close() }

    $window.FindName('BtnDone').Add_Click({ & $close 'Done' }.GetNewClosure())
    $window.FindName('BtnProgress').Add_Click({ & $close 'InProgress' }.GetNewClosure())
    $window.FindName('BtnClose').Add_Click({ & $close 'Dismiss' }.GetNewClosure())
    $window.FindName('Snooze5').Add_Click({ & $close 'Snooze5' }.GetNewClosure())
    $window.FindName('Snooze15').Add_Click({ & $close 'Snooze15' }.GetNewClosure())
    $window.FindName('Snooze60').Add_Click({ & $close 'Snooze60' }.GetNewClosure())

    $openAdo = $window.FindName('BtnOpenAdo')
    $adoUrl = [string](Get-OptionalProperty $Task 'AdoUrl')
    if ($adoUrl) {
        $openAdo.Add_Click({ Start-Process $adoUrl }.GetNewClosure())
    }
    else {
        $openAdo.Visibility = 'Collapsed'
    }

    $snoozeButton = $window.FindName('BtnSnooze')
    $snoozeButton.Add_Click({
        param($sender, $e)
        $sender.ContextMenu.PlacementTarget = $sender
        $sender.ContextMenu.Placement = [System.Windows.Controls.Primitives.PlacementMode]::Top
        $sender.ContextMenu.IsOpen = $true
    })

    Add-DragHandler -Window $window -Element $window.FindName('Header')

    $window.Add_ContentRendered({
        Set-WindowBottomRight -Window $window
        $window.Activate() | Out-Null
    }.GetNewClosure())

    $window.ShowDialog() | Out-Null
    return $script:ReminderResult
}

<#
.SYNOPSIS
Daily planner shown on the first run of each day. Returns a hashtable with Confirmed and ManualTasks.
#>
function Show-PlannerWindow {
    param(
        [string]$UserName,
        [array]$AdoTasks = @()
    )

    $adoCount = @($AdoTasks).Count
    $safeUser = [System.Security.SecurityElement]::Escape($UserName)

    $xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Plan your day" Width="620" Height="640"
        WindowStyle="None" AllowsTransparency="True" Background="Transparent"
        WindowStartupLocation="CenterScreen" ResizeMode="NoResize" Topmost="True">
$(Get-SharedResourceXaml)
  <Border Margin="18" CornerRadius="16" Background="{StaticResource Card}"
          BorderBrush="{StaticResource BorderBrushSoft}" BorderThickness="1">
    <Border.Effect>
      <DropShadowEffect BlurRadius="32" ShadowDepth="8" Opacity="0.6" Color="#000000"/>
    </Border.Effect>
    <Grid>
      <Grid.RowDefinitions>
        <RowDefinition Height="Auto"/>
        <RowDefinition Height="*"/>
        <RowDefinition Height="Auto"/>
      </Grid.RowDefinitions>

      <Border x:Name="Header" Grid.Row="0" Padding="24,20,18,16">
        <Grid>
          <StackPanel>
            <TextBlock Text="GOOD DAY, $($safeUser.ToUpper())" FontSize="11" FontWeight="Bold"
                       Foreground="{StaticResource Muted}"/>
            <TextBlock Text="Plan today's work" FontSize="24" FontWeight="SemiBold" Margin="0,6,0,0"/>
            <TextBlock FontSize="13" Foreground="{StaticResource Muted}" Margin="0,6,0,0"
                       Text="$adoCount active Azure DevOps task(s) imported. Add personal TODOs below."/>
          </StackPanel>
          <Button x:Name="BtnClose" Style="{StaticResource BaseButton}" Content="&#x2715;"
                  HorizontalAlignment="Right" VerticalAlignment="Top" Padding="8,2"
                  BorderThickness="0" Foreground="{StaticResource Muted}"/>
        </Grid>
      </Border>

      <ScrollViewer Grid.Row="1" Margin="24,0,24,0" VerticalScrollBarVisibility="Auto">
        <StackPanel>
          <TextBlock Text="FROM AZURE DEVOPS" FontSize="11" FontWeight="Bold"
                     Foreground="{StaticResource Muted}" Margin="0,4,0,8"/>
          <ItemsControl x:Name="AdoList">
            <ItemsControl.ItemTemplate>
              <DataTemplate>
                <Border Background="#12161F" CornerRadius="10" Padding="14,11" Margin="0,0,0,8"
                        BorderBrush="{StaticResource BorderBrushSoft}" BorderThickness="1">
                  <Grid>
                    <Grid.ColumnDefinitions>
                      <ColumnDefinition Width="Auto"/>
                      <ColumnDefinition Width="*"/>
                      <ColumnDefinition Width="Auto"/>
                      <ColumnDefinition Width="Auto"/>
                    </Grid.ColumnDefinitions>
                    <Border Grid.Column="0" Width="8" Height="8" CornerRadius="4" VerticalAlignment="Center"
                            Background="{Binding Accent}"/>
                    <StackPanel Grid.Column="1" Margin="12,0,0,0">
                      <TextBlock Text="{Binding Title}" TextWrapping="Wrap" FontSize="13"/>
                      <TextBlock Text="{Binding Meta}" FontSize="11" Foreground="{StaticResource Muted}"
                                 Margin="0,3,0,0"/>
                    </StackPanel>
                    <TextBlock Grid.Column="2" Text="{Binding Time}" FontSize="12"
                               Foreground="{StaticResource Muted}" VerticalAlignment="Center"/>
                    <Button Grid.Column="3" Style="{StaticResource BaseButton}"
                            Content="Open &#x2197;" Tag="{Binding Url}" Margin="10,0,0,0"
                            Padding="10,5" FontSize="11"/>
                  </Grid>
                </Border>
              </DataTemplate>
            </ItemsControl.ItemTemplate>
          </ItemsControl>

          <TextBlock Text="YOUR TODOS" FontSize="11" FontWeight="Bold"
                     Foreground="{StaticResource Muted}" Margin="0,16,0,8"/>
          <ItemsControl x:Name="ManualList">
            <ItemsControl.ItemTemplate>
              <DataTemplate>
                <Border Background="#12161F" CornerRadius="10" Padding="14,11" Margin="0,0,0,8"
                        BorderBrush="{StaticResource BorderBrushSoft}" BorderThickness="1">
                  <Grid>
                    <Grid.ColumnDefinitions>
                      <ColumnDefinition Width="*"/>
                      <ColumnDefinition Width="Auto"/>
                    </Grid.ColumnDefinitions>
                    <StackPanel Grid.Column="0">
                      <TextBlock Text="{Binding Title}" TextWrapping="Wrap" FontSize="13"/>
                      <TextBlock Text="{Binding Meta}" FontSize="11" Foreground="{StaticResource Muted}"
                                 Margin="0,3,0,0"/>
                    </StackPanel>
                    <TextBlock Grid.Column="1" Text="&#x2713;" Foreground="#3DD68C" FontSize="14"
                               VerticalAlignment="Center"/>
                  </Grid>
                </Border>
              </DataTemplate>
            </ItemsControl.ItemTemplate>
          </ItemsControl>

          <Border Background="#12161F" CornerRadius="10" Padding="14" Margin="0,4,0,16"
                  BorderBrush="{StaticResource BorderBrushSoft}" BorderThickness="1">
            <Grid>
              <Grid.ColumnDefinitions>
                <ColumnDefinition Width="*"/>
                <ColumnDefinition Width="Auto"/>
                <ColumnDefinition Width="Auto"/>
                <ColumnDefinition Width="Auto"/>
              </Grid.ColumnDefinitions>
              <TextBox x:Name="TxtTitle" Grid.Column="0" Margin="0,0,8,0"/>
              <TextBox x:Name="TxtTime" Grid.Column="1" Width="70" Margin="0,0,8,0"/>
              <ComboBox x:Name="CmbPriority" Grid.Column="2" Width="94" Margin="0,0,8,0">
                <ComboBoxItem Content="High"/>
                <ComboBoxItem Content="Medium" IsSelected="True"/>
                <ComboBoxItem Content="Low"/>
              </ComboBox>
              <Button x:Name="BtnAdd" Grid.Column="3" Style="{StaticResource BaseButton}" Content="Add"/>
            </Grid>
          </Border>
        </StackPanel>
      </ScrollViewer>

      <Border Grid.Row="2" Padding="24,16,24,20">
        <Grid>
          <TextBlock x:Name="LblHint" VerticalAlignment="Center" FontSize="12"
                     Foreground="{StaticResource Muted}" Text="Reminders follow schedule, then priority."/>
          <Button x:Name="BtnStart" Style="{StaticResource PrimaryButton}"
                  Content="Start reminders" HorizontalAlignment="Right" Padding="22,10"/>
        </Grid>
      </Border>
    </Grid>
  </Border>
</Window>
"@

    $window = ConvertTo-WpfWindow $xaml
    $script:PlannerManual = New-Object System.Collections.ArrayList

    $adoView = New-Object System.Collections.ObjectModel.ObservableCollection[object]
    foreach ($task in $AdoTasks) {
        $adoView.Add([pscustomobject]@{
            Title  = $task.Title
            Meta   = "$($task.Priority) priority  ·  ADO #$($task.AdoWorkItemId)"
            Time   = $task.ScheduleTime
            Accent = (Get-PriorityColor $task.Priority)
            Url    = Get-OptionalProperty $task 'AdoUrl'
        })
    }
    $adoList = $window.FindName('AdoList')
    $adoList.ItemsSource = $adoView
    $adoList.AddHandler(
        [System.Windows.Controls.Primitives.ButtonBase]::ClickEvent,
        [System.Windows.RoutedEventHandler] {
            param($sender, $e)
            $button = $e.OriginalSource -as [System.Windows.Controls.Button]
            if ($button -and $button.Tag) { Start-Process ([string]$button.Tag) }
        }
    )

    $manualView = New-Object System.Collections.ObjectModel.ObservableCollection[object]
    $window.FindName('ManualList').ItemsSource = $manualView

    $txtTitle = $window.FindName('TxtTitle')
    $txtTime = $window.FindName('TxtTime')
    $cmbPriority = $window.FindName('CmbPriority')
    $txtTime.Text = (Get-Date).ToString('HH:mm')

    $addTask = {
        $title = $txtTitle.Text.Trim()
        if (-not $title) { return }
        $time = $txtTime.Text.Trim()
        if ($time -notmatch '^([01]\d|2[0-3]):[0-5]\d$') { $time = (Get-Date).ToString('HH:mm') }
        $priority = [string]$cmbPriority.SelectedItem.Content

        [void]$script:PlannerManual.Add([pscustomobject]@{
            Title = $title
            ScheduleTime = $time
            Priority = $priority
        })
        $manualView.Add([pscustomobject]@{
            Title = $title
            Meta = "$priority priority  ·  $time"
        })
        $txtTitle.Text = ''
        $txtTitle.Focus() | Out-Null
    }.GetNewClosure()

    $window.FindName('BtnAdd').Add_Click($addTask)
    $txtTitle.Add_KeyDown({
        param($sender, $e)
        if ($e.Key -eq 'Return') { & $addTask }
    }.GetNewClosure())

    $script:PlannerConfirmed = $false
    $window.FindName('BtnStart').Add_Click({
        $script:PlannerConfirmed = $true
        $window.Close()
    }.GetNewClosure())
    $window.FindName('BtnClose').Add_Click({ $window.Close() }.GetNewClosure())

    Add-DragHandler -Window $window -Element $window.FindName('Header')
    $window.ShowDialog() | Out-Null

    return @{
        Confirmed = $script:PlannerConfirmed
        ManualTasks = @($script:PlannerManual)
    }
}

<#
.SYNOPSIS
Today's queue with inline status actions. Returns a list of requested changes.
#>
function Show-QueueWindow {
    param([array]$Tasks = @())

    # The queue is intentionally an active-work view. Completed items disappear;
    # history remains in state.json but is not shown in the operational list.
    $Tasks = @($Tasks | Where-Object { $_.Status -ne 'Completed' })

    $xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Today's tasks" Width="640" Height="620"
        WindowStyle="None" AllowsTransparency="True" Background="Transparent"
        WindowStartupLocation="CenterScreen" ResizeMode="NoResize" Topmost="True">
$(Get-SharedResourceXaml)
  <Border Margin="18" CornerRadius="16" Background="{StaticResource Card}"
          BorderBrush="{StaticResource BorderBrushSoft}" BorderThickness="1">
    <Border.Effect>
      <DropShadowEffect BlurRadius="32" ShadowDepth="8" Opacity="0.6" Color="#000000"/>
    </Border.Effect>
    <Grid>
      <Grid.RowDefinitions>
        <RowDefinition Height="Auto"/>
        <RowDefinition Height="*"/>
        <RowDefinition Height="Auto"/>
      </Grid.RowDefinitions>

      <Border x:Name="Header" Grid.Row="0" Padding="24,20,18,14">
        <Grid>
          <StackPanel>
            <TextBlock Text="TODAY" FontSize="11" FontWeight="Bold" Foreground="{StaticResource Muted}"/>
            <TextBlock x:Name="LblSummary" Text="Task queue" FontSize="22" FontWeight="SemiBold" Margin="0,6,0,0"/>
          </StackPanel>
          <Button x:Name="BtnClose" Style="{StaticResource BaseButton}" Content="&#x2715;"
                  HorizontalAlignment="Right" VerticalAlignment="Top" Padding="8,2"
                  BorderThickness="0" Foreground="{StaticResource Muted}"/>
        </Grid>
      </Border>

      <ScrollViewer Grid.Row="1" Margin="24,0,24,0" VerticalScrollBarVisibility="Auto">
        <ItemsControl x:Name="TaskList">
          <ItemsControl.ItemTemplate>
            <DataTemplate>
              <Border Background="#12161F" CornerRadius="10" Padding="14,12" Margin="0,0,0,8"
                      BorderBrush="{StaticResource BorderBrushSoft}" BorderThickness="1">
                <Grid>
                  <Grid.ColumnDefinitions>
                    <ColumnDefinition Width="Auto"/>
                    <ColumnDefinition Width="*"/>
                    <ColumnDefinition Width="Auto"/>
                    <ColumnDefinition Width="Auto"/>
                  </Grid.ColumnDefinitions>
                  <Border Grid.Column="0" Width="8" Height="8" CornerRadius="4"
                          VerticalAlignment="Center" Background="{Binding Accent}"/>
                  <StackPanel Grid.Column="1" Margin="12,0,12,0">
                    <TextBlock Text="{Binding Title}" TextWrapping="Wrap" FontSize="13"
                               TextDecorations="{Binding Strike}" Opacity="{Binding Fade}"/>
                    <TextBlock Text="{Binding Meta}" FontSize="11" Foreground="{StaticResource Muted}"
                               Margin="0,3,0,0"/>
                  </StackPanel>
                  <Button Grid.Column="2" Style="{StaticResource BaseButton}" Content="Open &#x2197;"
                          Padding="10,6" FontSize="11" Tag="{Binding Url}"
                          CommandParameter="Open" IsEnabled="{Binding HasUrl}" Margin="0,0,8,0"/>
                  <Button Grid.Column="3" Style="{StaticResource BaseButton}" Content="Mark done"
                          Padding="12,6" FontSize="12" Tag="{Binding Id}"
                          CommandParameter="Complete"/>
                </Grid>
              </Border>
            </DataTemplate>
          </ItemsControl.ItemTemplate>
        </ItemsControl>
      </ScrollViewer>

      <Border Grid.Row="2" Padding="24,14,24,20">
        <Grid>
          <Button x:Name="BtnSync" Style="{StaticResource BaseButton}" Content="Sync Azure DevOps"
                  HorizontalAlignment="Left"/>
          <Button x:Name="BtnDone" Style="{StaticResource PrimaryButton}" Content="Close"
                  HorizontalAlignment="Right" Padding="22,10"/>
        </Grid>
      </Border>
    </Grid>
  </Border>
</Window>
"@

    $window = ConvertTo-WpfWindow $xaml
    $script:QueueCompleted = New-Object System.Collections.ArrayList
    $script:QueueSyncRequested = $false

    $view = New-Object System.Collections.ObjectModel.ObservableCollection[object]
    foreach ($task in $Tasks) {
        $source = if ($task.AdoWorkItemId) { "ADO #$($task.AdoWorkItemId)" } else { 'Personal' }
        $view.Add([pscustomobject]@{
            Id = $task.Id
            Title = $task.Title
            Meta = "$($task.ScheduleTime)  ·  $($task.Priority)  ·  $source  ·  $($task.Status)"
            Accent = (Get-PriorityColor $task.Priority)
            Strike = $null
            Fade = 1.0
            Url = Get-OptionalProperty $task 'AdoUrl'
            HasUrl = [bool](Get-OptionalProperty $task 'AdoUrl')
        })
    }

    $list = $window.FindName('TaskList')
    $list.ItemsSource = $view
    $window.FindName('LblSummary').Text = "$(@($Tasks).Count) active task(s)"

    # Click events bubble from the templated buttons, so one handler covers every row.
    $list.AddHandler(
        [System.Windows.Controls.Primitives.ButtonBase]::ClickEvent,
        [System.Windows.RoutedEventHandler] {
            param($sender, $e)
            $button = $e.OriginalSource -as [System.Windows.Controls.Button]
            if (-not $button -or -not $button.Tag) { return }
            if ([string]$button.CommandParameter -eq 'Open') {
                Start-Process ([string]$button.Tag)
                return
            }
            [void]$script:QueueCompleted.Add([string]$button.Tag)
            $button.IsEnabled = $false
            $button.Content = 'Done'
        }
    )

    $window.FindName('BtnSync').Add_Click({
        $script:QueueSyncRequested = $true
        $window.Close()
    }.GetNewClosure())
    $window.FindName('BtnDone').Add_Click({ $window.Close() }.GetNewClosure())
    $window.FindName('BtnClose').Add_Click({ $window.Close() }.GetNewClosure())

    Add-DragHandler -Window $window -Element $window.FindName('Header')
    $window.ShowDialog() | Out-Null

    return @{
        Completed = @($script:QueueCompleted)
        SyncRequested = $script:QueueSyncRequested
    }
}

function Show-ToastMessage {
    param(
        [Parameter(Mandatory)]$NotifyIcon,
        [string]$Title = 'Daily Task Reminder',
        [Parameter(Mandatory)][string]$Message,
        [ValidateSet('Info', 'Warning', 'Error')][string]$Level = 'Info'
    )
    $icon = switch ($Level) {
        'Warning' { [System.Windows.Forms.ToolTipIcon]::Warning }
        'Error' { [System.Windows.Forms.ToolTipIcon]::Error }
        default { [System.Windows.Forms.ToolTipIcon]::Info }
    }
    $NotifyIcon.ShowBalloonTip(5000, $Title, $Message, $icon)
}
